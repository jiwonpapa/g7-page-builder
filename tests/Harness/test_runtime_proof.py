import json
import subprocess
from pathlib import Path
import tempfile
import unittest
from tools.g7pb.runtime_proof import RuntimeProof


class RuntimeDatabaseFingerprintTests(unittest.TestCase):
    def php(self, body):
        root = Path(__file__).resolve().parents[2]
        script = "require " + json.dumps(str(root / 'scripts/runtime-state.php')) + ";" + body
        result = subprocess.run(['php', '-r', script], capture_output=True, text=True, timeout=30, check=True)
        return json.loads(result.stdout)

    def test_same_complete_multiset_digest_and_order_independence(self):
        result = self.php('''
        $data=['z'=>[['id'=>2,'value'=>null],['value'=>'','id'=>1]],'a'=>[['id'=>3,'value'=>'x']]];
        $expected=hash_init('sha256'); ksort($data);
        foreach($data as $table=>$rows){$hashes=[];foreach($rows as $row){ksort($row);$hashes[]=hash('sha256',serialize($row));}sort($hashes,SORT_STRING);hash_update($expected,$table."\\0".implode('',$hashes));}
        $actual=runtimeDatabaseFingerprint(['z','a'],fn($table)=>array_reverse($data[$table]));
        $before=$actual; $data['z'][]=['id'=>2,'value'=>null];
        echo json_encode(['equal'=>$actual===hash_final($expected),'duplicate_changes'=>$before!==runtimeDatabaseFingerprint(['a','z'],fn($table)=>$data[$table])]);
        ''')
        self.assertEqual(result, {'equal': True, 'duplicate_changes': True})

    def test_more_than_two_hundred_thousand_rows_are_all_hashed(self):
        result = self.php('''
        $seen=0;$last='original';
        $rows=static function($table)use(&$seen,&$last){for($i=0;$i<210001;$i++){++$seen;yield ['id'=>$i,'value'=>$i===210000?$last:'row'];}};
        $first=runtimeDatabaseFingerprint(['rows'],$rows);$last='changed';
        $second=runtimeDatabaseFingerprint(['rows'],$rows);
        echo json_encode(['seen'=>$seen,'changed'=>$first!==$second,'length'=>strlen($first)]);
        ''')
        self.assertEqual(result, {'seen': 420002, 'changed': True, 'length': 64})

    def test_time_and_memory_exhaustion_fail_closed_without_a_digest(self):
        result = self.php('''
        $results=[];
        foreach(['time','memory'] as $kind){$calls=0;$resources=static function()use(&$calls,$kind){$n=$calls++;return $kind==='time'?[$n*26000000000,0]:[0,$n*65*1024*1024];};
          try{runtimeDatabaseFingerprint(['rows'],fn()=>[['id'=>1]],$resources);$results[$kind]='unexpected digest';}
          catch(RuntimeException $error){$results[$kind]=$error->getMessage();}}
        echo json_encode($results);
        ''')
        self.assertIn('time budget exceeded', result['time'])
        self.assertIn('memory budget exceeded', result['memory'])

    def test_invalid_table_is_rejected_before_reading(self):
        result = self.php('''
        $reads=0;try{runtimeDatabaseFingerprint(['rows`'],function()use(&$reads){++$reads;return [];});}
        catch(RuntimeException $error){echo json_encode(['reads'=>$reads,'error'=>$error->getMessage()]);}
        ''')
        self.assertEqual(result['reads'], 0)
        self.assertIn('table identifier', result['error'])


class RuntimeProofTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.state = {'environment': 'build-1/container-1', 'state': 'db-1'}
        self.proof = RuntimeProof(self.root, 'owned', self.root/'receipts', lambda *_: dict(self.state))
        evidence = self.root/'output/playwright/fixture'
        evidence.mkdir(parents=True)
        self.record = {'key':'a', 'status':'passed', 'gate':'browser:a', 'evidence':{'directory':'output/playwright/fixture'}}
        (evidence/'execution.json').write_text(json.dumps(self.record))

    def passed(self):
        self.proof.prepare(); self.proof.started(); self.proof.finished(self.record)

    def test_known_failed_step_preserves_prior_success_for_resume(self):
        self.passed()
        self.proof.prepare(); self.proof.started()
        self.state['state'] = 'db-after-known-failure'
        self.proof.finished({'key':'b', 'status':'failed'})
        self.assertTrue(self.proof.prepare())
        self.assertEqual(self.proof.receipt('a'), self.record)
        self.assertIsNone(self.proof.receipt('b'))

    def test_unobserved_database_build_or_container_change_invalidates(self):
        for field in ('state', 'environment'):
            with self.subTest(field=field):
                self.passed()
                self.state[field] += '-external-change'
                self.proof.prepare()
                self.assertIsNone(self.proof.receipt('a'))

    def test_interruption_and_restore_failure_cannot_reuse(self):
        self.passed(); self.proof.prepare(); self.proof.started()
        self.proof.prepare()
        self.assertIsNone(self.proof.receipt('a'))
        self.passed(); self.proof.prepare(); self.proof.started()
        self.proof.finished(self.record, restored=False)
        self.proof.prepare()
        self.assertIsNone(self.proof.receipt('a'))

    def test_missing_evidence_or_observer_disables_reuse(self):
        self.passed()
        (self.root/'output/playwright/fixture/execution.json').unlink()
        self.proof.prepare()
        self.assertIsNone(self.proof.receipt('a'))
        self.proof.observer = lambda *_: (_ for _ in ()).throw(ValueError('unavailable'))
        self.assertFalse(self.proof.prepare())
