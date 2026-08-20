<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence;

use Illuminate\Database\Eloquent\Collection;
use Modules\Jiwonpapa\PageBuilder\Contracts\BlockUsagePort;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackManifest;
use Modules\Jiwonpapa\PageBuilder\Domain\Blocks\BlockPackUsage;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Persistence\Models\RevisionRecord;

final class EloquentBlockUsageAdapter implements BlockUsagePort
{
    public function summarize(BlockPackManifest $manifest): BlockPackUsage
    {
        return $this->summarizeBlockIdentities(array_map(
            static fn ($definition): string => $definition->blockId.'@'.$definition->blockVersion,
            $manifest->blocks,
        ));
    }

    public function summarizeBlockIdentities(array $blockIdentities): BlockPackUsage
    {
        $blockIds = array_fill_keys($blockIdentities, true);
        if ($blockIds === []) {
            return new BlockPackUsage(0, 0);
        }

        /** @var Collection<int, RevisionRecord> $revisions */
        $revisions = RevisionRecord::query()
            ->select(['document_id', 'document_json'])
            ->orderBy('document_id')
            ->orderBy('revision')
            ->get();
        $documents = [];
        $revisionCount = 0;

        foreach ($revisions as $revision) {
            $payload = json_decode($revision->document_json, true);
            if (! is_array($payload) || ! $this->containsBlock($payload['blocks'] ?? null, $blockIds)) {
                continue;
            }
            $documents[$revision->document_id] = true;
            $revisionCount++;
        }

        return new BlockPackUsage(count($documents), $revisionCount);
    }

    /**
     * @param  array<string, true>  $blockIds
     */
    private function containsBlock(mixed $blocks, array $blockIds): bool
    {
        if (! is_array($blocks)) {
            return false;
        }
        foreach ($blocks as $block) {
            if (! is_array($block)) {
                continue;
            }
            $type = $block['type'] ?? null;
            $version = $block['block_version'] ?? null;
            if (is_string($type) && is_int($version) && isset($blockIds[$type.'@'.$version])) {
                return true;
            }
            $slots = $block['slots'] ?? null;
            if (is_array($slots)) {
                foreach ($slots as $slotBlocks) {
                    if ($this->containsBlock($slotBlocks, $blockIds)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }
}
