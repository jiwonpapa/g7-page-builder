<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\PageBuilderDocument;
use Modules\Jiwonpapa\PageBuilder\Domain\Media\PortableMedia;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\PageKitBundle;
use Modules\Jiwonpapa\PageBuilder\Domain\Store\StoreArtifact;

interface PageKitArchivePort
{
    public function read(StoreArtifact $artifact): PageKitBundle;

    /** @param list<PortableMedia> $media */
    public function write(
        string $kitId,
        string $kitVersion,
        string $title,
        string $description,
        PageBuilderDocument $document,
        array $media,
    ): StoreArtifact;

    public function release(StoreArtifact $artifact): void;
}
