<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Console;

use Illuminate\Console\Command;
use Modules\Jiwonpapa\PageBuilder\Application\SitePartArtifactUpgrade;

final class PrepareSitePartArtifactsCommand extends Command
{
    protected $signature = 'page-builder:site-part-artifacts {--prepare : Explicitly prepare missing published artifacts} {--limit=100 : Maximum artifacts prepared per invocation}';

    protected $description = 'Check Site Part artifact readiness before cutover; source JSON and active pointers are preserved.';

    public function handle(SitePartArtifactUpgrade $upgrade): int
    {
        try {
            if ($this->option('prepare')) {
                $limit = filter_var($this->option('limit'), FILTER_VALIDATE_INT);
                if (! is_int($limit)) {
                    throw new \InvalidArgumentException('The preparation limit must be an integer.');
                }
                $this->info('Prepared '.$upgrade->prepare($limit).' immutable Site Part artifacts.');
            }
            $upgrade->check();
            $this->info('Site Part artifacts are ready for cutover.');

            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error('Site Part cutover blocked: '.$exception->getMessage());

            return self::FAILURE;
        }
    }
}
