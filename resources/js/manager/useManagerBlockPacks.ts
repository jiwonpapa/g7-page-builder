import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { PageBuilderApiClient } from '../api/pageBuilderApi';
import type { BlockPackResource, GitHubBlockPackCheckResource } from '../blocks/types';

export function useManagerBlockPacks({ api, onError, onMessage }: {
  api: PageBuilderApiClient;
  onError: (error: unknown) => void;
  onMessage: (message: string | null) => void;
}) {
  const [blockPacksOpen, setBlockPacksOpen] = useState(false);
  const [blockPacks, setBlockPacks] = useState<BlockPackResource[]>([]);
  const [blockPacksLoading, setBlockPacksLoading] = useState(false);
  const [blockPackBusy, setBlockPackBusy] = useState<string | null>(null);
  const [githubInput, setGithubInput] = useState({ owner: '', repository: '', assetName: 'g7pb-block-pack.zip' });
  const [githubCheck, setGithubCheck] = useState<GitHubBlockPackCheckResource | null>(null);
  const input = useRef(githubInput);
  const checkedInput = useRef<typeof githubInput | null>(null);
  const owner = useRef({ active: false, generation: 0 });
  const listRequest = useRef(0);
  const checkRequest = useRef(0);
  const operationId = useRef(0);
  const busy = useRef<string | null>(null);

  const loadBlockPacks = useCallback(async (): Promise<boolean> => {
    const generation = owner.current.generation;
    const request = ++listRequest.current;
    const current = () => owner.current.active && owner.current.generation === generation && listRequest.current === request;
    setBlockPacksLoading(true);
    try {
      const resource = await api.listBlockPacks();
      if (!current()) return false;
      setBlockPacks(resource.items);
      return true;
    } catch (error) {
      if (current()) onError(error);
      return false;
    } finally {
      if (current()) setBlockPacksLoading(false);
    }
  }, [api, onError]);

  const openBlockPacks = (): void => { setBlockPacksOpen(true); onMessage(null); void loadBlockPacks(); };
  const closeBlockPacks = (): void => { listRequest.current += 1; setBlockPacksOpen(false); setBlockPacksLoading(false); };
  useEffect(() => {
    owner.current.active = true;
    owner.current.generation += 1;
    if (new URLSearchParams(window.location.search).get('view') === 'block-library') openBlockPacks();
    return () => {
      owner.current.active = false;
      owner.current.generation += 1;
      listRequest.current += 1;
      checkRequest.current += 1;
      operationId.current += 1;
      busy.current = null;
    };
  }, [api]);

  const beginOperation = (key: string) => {
    if (!owner.current.active || busy.current !== null) return null;
    const generation = owner.current.generation;
    const operation = ++operationId.current;
    const current = () => owner.current.active && owner.current.generation === generation && operationId.current === operation;
    busy.current = key;
    setBlockPackBusy(key);
    onMessage(null);
    return { current, finish: () => { if (current()) { busy.current = null; setBlockPackBusy(null); } } };
  };

  const changeInput = (patch: Partial<typeof githubInput>): void => {
    input.current = { ...input.current, ...patch };
    setGithubInput(input.current);
    checkedInput.current = null;
    setGithubCheck(null);
    checkRequest.current += 1;
    if (busy.current === 'github-check') {
      operationId.current += 1;
      busy.current = null;
      setBlockPackBusy(null);
    }
  };
  const sameInput = (value: typeof githubInput) => value.owner === input.current.owner
    && value.repository === input.current.repository && value.assetName === input.current.assetName;

  const checkGitHubBlockPack = async (): Promise<void> => {
    const snapshot = { ...input.current };
    if (!snapshot.owner.trim() || !snapshot.repository.trim() || !snapshot.assetName.trim()) {
      onMessage('GitHub 소유자, 저장소, Release ZIP asset 이름을 입력해 주세요.');
      return;
    }
    const operation = beginOperation('github-check');
    if (!operation) return;
    const request = ++checkRequest.current;
    setGithubCheck(null);
    checkedInput.current = null;
    try {
      const result = await api.checkGitHubBlockPack(snapshot.owner.trim(), snapshot.repository.trim(), snapshot.assetName.trim());
      if (operation.current() && request === checkRequest.current && sameInput(snapshot)) {
        checkedInput.current = snapshot;
        setGithubCheck(result);
      }
    } catch (error) {
      if (operation.current() && request === checkRequest.current) onError(error);
    } finally { operation.finish(); }
  };

  const installGitHubBlockPack = async (): Promise<void> => {
    const snapshot = checkedInput.current;
    if (!snapshot || !sameInput(snapshot) || !githubCheck?.update_available) return;
    const operation = beginOperation('github-install');
    if (!operation) return;
    try {
      await api.installGitHubBlockPack(snapshot.owner.trim(), snapshot.repository.trim(), snapshot.assetName.trim());
      if (!operation.current()) return;
      const loaded = await loadBlockPacks();
      if (!operation.current()) return;
      if (sameInput(snapshot)) {
        const request = ++checkRequest.current;
        const result = await api.checkGitHubBlockPack(snapshot.owner.trim(), snapshot.repository.trim(), snapshot.assetName.trim());
        if (operation.current() && request === checkRequest.current && sameInput(snapshot)) {
          checkedInput.current = snapshot;
          setGithubCheck(result);
        }
      }
      if (operation.current() && loaded) onMessage('GitHub 블록 팩 설치 완료 · 편집기 상단 ‘블록 추가’의 출처 필터에서 확인할 수 있습니다.');
    } catch (error) {
      if (operation.current()) onError(error);
    } finally { operation.finish(); }
  };

  const installBlockPack = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const archive = event.target.files?.[0];
    event.target.value = '';
    if (!archive) return;
    const operation = beginOperation('install');
    if (!operation) return;
    try {
      await api.installBlockPack(archive, true);
      if (!operation.current()) return;
      const loaded = await loadBlockPacks();
      if (operation.current() && loaded) onMessage('블록 팩 설치 완료 · 활성화된 블록과 완성 섹션은 편집기 상단 ‘블록 추가’에 표시됩니다.');
    } catch (error) {
      if (operation.current()) onError(error);
    } finally { operation.finish(); }
  };
  const changeBlockPackState = async (pack: BlockPackResource): Promise<void> => {
    const operation = beginOperation(`${pack.pack_id}@${pack.pack_version}`);
    if (!operation) return;
    try {
      await api.setBlockPackState(pack.pack_id, pack.pack_version, pack.state === 'enabled' ? 'disabled' : 'enabled');
      if (operation.current()) await loadBlockPacks();
    } catch (error) {
      if (operation.current()) onError(error);
    } finally { operation.finish(); }
  };
  const removeBlockPack = async (pack: BlockPackResource): Promise<void> => {
    const usage = pack.usage;
    if (usage && (usage.documents > 0 || usage.revisions > 0)) {
      onMessage(`사용 중인 블록 팩입니다. 문서 ${usage.documents}개, 리비전 ${usage.revisions}개에서 참조합니다.`);
      return;
    }
    if (!window.confirm(`${pack.pack_id} ${pack.pack_version} 파일을 제거할까요?`)) return;
    const operation = beginOperation(`${pack.pack_id}@${pack.pack_version}`);
    if (!operation) return;
    try {
      await api.removeBlockPack(pack.pack_id, pack.pack_version);
      if (operation.current()) await loadBlockPacks();
    } catch (error) {
      if (operation.current()) onError(error);
    } finally { operation.finish(); }
  };

  return { blockPacksOpen, openBlockPacks, closeBlockPacks, blockPacks, blockPacksLoading, blockPackBusy, loadBlockPacks,
    githubOwner: githubInput.owner, githubRepository: githubInput.repository, githubAssetName: githubInput.assetName,
    setGithubOwner: (value: string) => changeInput({ owner: value }), setGithubRepository: (value: string) => changeInput({ repository: value }),
    setGithubAssetName: (value: string) => changeInput({ assetName: value }), githubCheck,
    checkGitHubBlockPack, installGitHubBlockPack, installBlockPack, changeBlockPackState, removeBlockPack };
}
