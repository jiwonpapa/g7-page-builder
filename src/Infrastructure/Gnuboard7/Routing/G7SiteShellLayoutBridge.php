<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Routing;

use App\Extension\HookManager;
use App\Services\TemplateService;
use Illuminate\Support\Facades\Log;
use Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Layout\UserTemplateSiteShellDecorator;

final class G7SiteShellLayoutBridge
{
    private bool $registered = false;

    public function __construct(
        private readonly TemplateService $templates,
        private readonly UserTemplateSiteShellDecorator $decorator,
    ) {}

    public function register(): void
    {
        if ($this->registered || ! (bool) config('g7-page-builder.site-shell.enabled', true)) {
            return;
        }

        HookManager::addFilter(
            'core.layout_extension.after_apply',
            fn (array $layout, int $templateId): array => $this->filter($layout, $templateId),
            90,
        );
        $this->registered = true;
    }

    /**
     * @param  array<string, mixed>  $layout
     * @return array<string, mixed>
     */
    public function filter(array $layout, int $templateId): array
    {
        try {
            $identifier = $this->templates->getActiveTemplateIdentifier('user');
            $template = $this->templates->findByIdentifier($identifier);
            if ($template === null || (int) data_get($template, 'id', 0) !== $templateId) {
                return $layout;
            }

            $version = data_get($template, 'version');
            $type = data_get($template, 'type');
            if (! is_string($version) || ! is_string($type)
                || ! $this->decorator->supports($identifier, $version, $type)) {
                return $layout;
            }

            return $this->decorator->decorate($layout);
        } catch (\Throwable $exception) {
            Log::warning('Page Builder global Site Shell bridge was skipped.', [
                'template_id' => $templateId,
                'exception' => $exception,
            ]);

            return $layout;
        }
    }
}
