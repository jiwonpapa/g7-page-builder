<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\Integration\Gnuboard7;

use Illuminate\Container\Container;
use Illuminate\Contracts\Routing\ResponseFactory;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Facade;
use Illuminate\Translation\ArrayLoader;
use Illuminate\Translation\Translator;
use Illuminate\Validation\Factory as ValidationFactory;
use Modules\Jiwonpapa\PageBuilder\Application\PageBuilderService;
use Modules\Jiwonpapa\PageBuilder\Contracts\DocumentCompilerPort;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\CompileResult;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\DocumentSnapshot;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\LockConflictException;
use Modules\Jiwonpapa\PageBuilder\Domain\Persistence\PublicationCommitException;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http\Controllers\AdminDocumentController;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\EloquentPageBuilderRepository;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\DocumentRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\PublicationRecord;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\RevisionRecord;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

/** Synthetic documents in an isolated DB exercise code, not installed content. */
final class PublicationLifecycleGuardTest extends TestCase
{
    private Capsule $database;

    private EloquentPageBuilderRepository $repository;

    private DocumentSnapshot $snapshot;

    protected function setUp(): void
    {
        parent::setUp();
        $this->database = new Capsule;
        $this->database->addConnection(['driver' => 'sqlite', 'database' => ':memory:', 'foreign_key_constraints' => true]);
        $this->database->setAsGlobal();
        $this->database->bootEloquent();
        $container = $this->database->getContainer();
        $container->instance('db', $this->database->getDatabaseManager());
        $container->instance('db.schema', $this->database->getConnection()->getSchemaBuilder());
        $container->instance('log', new NullLogger);
        $response = $this->createStub(ResponseFactory::class);
        $response->method('json')->willReturnCallback(static fn (mixed $data = [], int $status = 200): JsonResponse => new JsonResponse($data, $status));
        $container->instance(ResponseFactory::class, $response);
        $container->instance('validator', new ValidationFactory(new Translator(new ArrayLoader, 'ko'), $container));
        Container::setInstance($container);
        Facade::setFacadeApplication($container);
        foreach (glob(dirname(__DIR__, 3).'/database/migrations/*.php') ?: [] as $file) {
            (require $file)->up();
        }
        $this->repository = new EloquentPageBuilderRepository;
        $this->snapshot = $this->repository->create('Fixture', new PageBuilderDocument(
            '00000000-0000-4000-8000-000000000001', 'lifecycle-fixture', 'canvas', 'ko', [], [],
        ), 1);
    }

    protected function tearDown(): void
    {
        Facade::clearResolvedInstances();
        Facade::setFacadeApplication(null);
        Container::setInstance(null);
        Model::unsetConnectionResolver();
        $this->database->getDatabaseManager()->disconnect();
        parent::tearDown();
    }

    public function test_archived_prepare_returns_conflict_without_compilation(): void
    {
        $archived = $this->repository->archive($this->snapshot->document->documentId, 1, 1);
        $compiler = $this->createMock(DocumentCompilerPort::class);
        $compiler->expects(self::never())->method('compile');
        $controller = new AdminDocumentController(new PageBuilderService($this->repository, $compiler));
        $response = $controller->preparePublication(Request::create('/fixture', 'POST', ['expected_lock_version' => $archived->lockVersion]), $archived->document->documentId);
        self::assertSame(409, $response->getStatusCode());
        self::assertStringContainsString('G7PB_PUBLICATION_INVALID', (string) $response->getContent());
        self::assertSame(0, PublicationRecord::query()->count());
    }

    public function test_repository_rejects_preparation_after_archive_even_with_a_current_lock(): void
    {
        $archived = $this->repository->archive($this->snapshot->document->documentId, 1, 1);
        $this->expectException(PublicationCommitException::class);
        try {
            $this->prepare($archived);
        } finally {
            self::assertSame(0, PublicationRecord::query()->count());
        }
    }

    public function test_archive_between_prepare_and_commit_cannot_republish(): void
    {
        $this->prepare($this->snapshot);
        $this->repository->archive($this->snapshot->document->documentId, 1, 1);
        $this->expectException(PublicationCommitException::class);
        try {
            $this->repository->commitPublication(hash('sha256', 'fixture'), new \DateTimeImmutable);
        } finally {
            self::assertSame(0, PublicationRecord::query()->where('status', 'active')->count());
            self::assertNull($this->repository->findPublishedBySlug('lifecycle-fixture'));
        }
    }

    public function test_archived_rows_are_hidden_even_if_an_old_active_pointer_survives(): void
    {
        $this->prepare($this->snapshot);
        $this->repository->commitPublication(hash('sha256', 'fixture'), new \DateTimeImmutable);
        DocumentRecord::query()->whereKey($this->snapshot->document->documentId)->update(['archived_at' => new \DateTimeImmutable, 'is_home' => true]);
        self::assertNull($this->repository->findPublishedBySlug('lifecycle-fixture'));
        self::assertNull($this->repository->findPublishedHome());
        $this->expectException(PublicationCommitException::class);
        $this->repository->setHome($this->snapshot->document->documentId, true, 1, 1);
    }

    public function test_restored_page_can_publish_but_old_candidates_remain_stale(): void
    {
        $this->prepare($this->snapshot, 'old');
        $archived = $this->repository->archive($this->snapshot->document->documentId, 1, 1);
        $restored = $this->repository->restoreArchived($archived->document->documentId, $archived->lockVersion, 1);
        try {
            $this->repository->commitPublication(hash('sha256', 'old'), new \DateTimeImmutable);
            self::fail('An old candidate must remain stale after restore.');
        } catch (LockConflictException) {
            self::assertNull($this->repository->findPublishedBySlug('lifecycle-fixture'));
        }
        $this->prepare($restored);
        $this->repository->commitPublication(hash('sha256', 'fixture'), new \DateTimeImmutable);
        self::assertSame('<main>fixture</main>', $this->repository->findPublishedBySlug('lifecycle-fixture')?->artifact);
    }

    public function test_recovered_invalid_draft_is_readable_but_cannot_create_a_revision(): void
    {
        $data = $this->snapshot->document->toArray();
        $data['blocks'] = [['instance_id' => 'old-invalid-id', 'type' => 'content.hero-centered-01', 'block_version' => 1, 'props' => []]];
        RevisionRecord::query()->where('document_id', $this->snapshot->document->documentId)->update(['document_json' => json_encode($data, JSON_THROW_ON_ERROR)]);
        $recovered = $this->repository->find($this->snapshot->document->documentId);
        self::assertSame($data['blocks'], $recovered?->document->blocks);
        self::assertNotNull($recovered);
        $this->expectException(\InvalidArgumentException::class);
        try {
            $this->repository->saveDraft($recovered->document, 1, 1);
        } finally {
            self::assertSame(1, RevisionRecord::query()->count());
            self::assertSame(1, $this->repository->find($this->snapshot->document->documentId)?->lockVersion);
        }
    }

    private function prepare(DocumentSnapshot $snapshot, string $token = 'fixture'): void
    {
        $artifact = '<main>fixture</main>';
        $result = new CompileResult('test', $snapshot->document->documentId, $snapshot->revision, 'html', 'fixture', $artifact, hash('sha256', $artifact));
        $this->repository->storePublicationCandidate($result, $snapshot->lockVersion, hash('sha256', $token), new \DateTimeImmutable('+1 minute'), 1);
    }
}
