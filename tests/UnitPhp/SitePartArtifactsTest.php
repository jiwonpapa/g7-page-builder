<?php

namespace Modules\Jiwonpapa\PageBuilder\Tests\UnitPhp;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\SitePartHtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartArtifactUpgrade;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartService;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartArtifactPort;
use Modules\Jiwonpapa\PageBuilder\Contracts\SitePartRepository;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\PublishedSitePartSet;
use Modules\Jiwonpapa\PageBuilder\Domain\Publishing\SitePartArtifact;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Site\SitePartSnapshot;
use PHPUnit\Framework\TestCase;

final class SitePartArtifactsTest extends TestCase
{
    public function test_public_lookup_uses_one_stored_pair_without_reading_source_documents(): void
    {
        $header = new SitePartArtifact('header', '<header>old</header>', hash('sha256', "0.1.0\n<header>old</header>"), '0.1.0', 1);
        $pair = new PublishedSitePartSet('set-a', 'ko', $header, null);
        $repository = $this->createMock(SitePartRepository::class);
        $repository->expects(self::once())->method('findPublishedSet')->with('ko')->willReturn($pair);
        $repository->expects(self::never())->method('findPublished');
        $repository->expects(self::never())->method('find');
        $service = new SitePartService($repository, new SitePartHtmlCompiler);
        self::assertSame($pair, $service->publishedSet('ko'));
        self::assertFalse($pair->isComplete());
    }

    public function test_artifact_digest_is_validated_independently_of_current_compiler_version(): void
    {
        $valid = new SitePartArtifact('footer', 'old html', hash('sha256', "0.0.1\nold html"), '0.0.1', 5);
        self::assertSame('old html', $valid->html);
        $this->expectException(\InvalidArgumentException::class);
        new SitePartArtifact('footer', 'changed html', $valid->artifactSha256, '0.0.1', 5);
    }

    public function test_readiness_check_never_compiles_or_writes_and_fails_closed(): void
    {
        $port = $this->createMock(SitePartArtifactPort::class);
        $port->expects(self::never())->method('missingPublications');
        $port->expects(self::never())->method('prepareHistorical');
        $port->expects(self::once())->method('assertReady')->willThrowException(new \RuntimeException('missing'));
        $this->expectException(\RuntimeException::class);
        (new SitePartArtifactUpgrade($port, new SitePartHtmlCompiler))->check();
    }

    public function test_explicit_preparation_uses_only_the_bounded_published_snapshot(): void
    {
        $document = new SitePartDocument('00000000-0000-4000-8000-000000000001', 'header', 'ko', [], [[
            'instance_id' => '00000000-0000-4000-8000-000000000002', 'type' => 'site.header.navigation-01', 'block_version' => 1,
            'props' => ['brand_name' => 'Fixture', 'home_url' => '/'], 'slots' => [],
        ]]);
        $source = new SitePartSnapshot($document, 'Fixture', 3, 1, 1);
        $port = $this->createMock(SitePartArtifactPort::class);
        $port->expects(self::once())->method('missingPublications')->with(1)->willReturn([$source]);
        $port->expects(self::once())->method('prepareHistorical')->with($source, self::callback(static fn (SitePartArtifact $artifact): bool => $artifact->sourceRevision === 1 && $artifact->kind === 'header'));
        self::assertSame(1, (new SitePartArtifactUpgrade($port, new SitePartHtmlCompiler))->prepare(1));
        self::assertSame('Fixture', $source->document->blocks[0]['props']['brand_name']);
    }
}
