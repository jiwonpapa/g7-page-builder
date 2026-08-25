<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Layout;

/**
 * 활성 User Template의 병합 결과에 Page Builder Site Part를 fail-safe로 연결합니다.
 *
 * 원본 노드는 삭제하지 않고 조건만 추가합니다. 공개 API가 실패하거나 두 Site Part 중
 * 하나라도 없으면 blocking data source의 fallback이 enabled=false가 되어 원본 셸이 렌더됩니다.
 */
final class UserTemplateSiteShellDecorator
{
    public const DATA_SOURCE_ID = 'g7pb_site_shell';

    /** @var list<string> */
    private const NATIVE_HEADER_IDS = [
        'mobile_overlay',
        'mobile_header',
        'mobile_nav_drawer',
        'desktop_header',
    ];

    private const NATIVE_FOOTER_ID = 'footer';

    private const BUILDER_HEADER_ID = 'g7pb_global_site_header';

    private const BUILDER_FOOTER_ID = 'g7pb_global_site_footer';

    private const ENABLED_EXPRESSION = 'g7pb_site_shell?.data?.shell?.enabled';

    public function supports(string $identifier, string $version, string $type): bool
    {
        if ($type !== 'user' || $identifier !== 'sirsoft-basic') {
            return false;
        }

        if (preg_match('/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/', $version, $matches) !== 1) {
            return false;
        }

        return (int) $matches[1] === 1 && (int) $matches[2] >= 1;
    }

    /**
     * @param  array<string, mixed>  $layout
     * @return array<string, mixed>
     */
    public function decorate(array $layout): array
    {
        if ($this->hasDataSource($layout, self::DATA_SOURCE_ID)
            || $this->countId($layout, self::BUILDER_HEADER_ID) > 0
            || $this->countId($layout, self::BUILDER_FOOTER_ID) > 0) {
            return $layout;
        }

        foreach ([...self::NATIVE_HEADER_IDS, self::NATIVE_FOOTER_ID] as $requiredId) {
            if ($this->countId($layout, $requiredId) !== 1) {
                return $layout;
            }
        }
        if (! $this->targetConditionsAreSafe($layout)) {
            return $layout;
        }

        $decorated = $this->decorateValue($layout);
        if (! is_array($decorated)) {
            return $layout;
        }

        $sources = $decorated['data_sources'] ?? [];
        if (! is_array($sources) || ! array_is_list($sources)) {
            return $layout;
        }

        $sources[] = $this->dataSource();
        $decorated['data_sources'] = $sources;

        return $decorated;
    }

    /**
     * @param  array<string, mixed>  $layout
     */
    private function hasDataSource(array $layout, string $id): bool
    {
        $sources = $layout['data_sources'] ?? [];
        if (! is_array($sources)) {
            return false;
        }

        foreach ($sources as $source) {
            if (is_array($source) && ($source['id'] ?? null) === $id) {
                return true;
            }
        }

        return false;
    }

    private function countId(mixed $value, string $id): int
    {
        if (! is_array($value)) {
            return 0;
        }

        $count = ($value['id'] ?? null) === $id ? 1 : 0;
        foreach ($value as $child) {
            $count += $this->countId($child, $id);
        }

        return $count;
    }

    private function targetConditionsAreSafe(mixed $value): bool
    {
        if (! is_array($value)) {
            return true;
        }

        $id = $value['id'] ?? null;
        if (is_string($id) && in_array($id, [...self::NATIVE_HEADER_IDS, self::NATIVE_FOOTER_ID], true)) {
            if (array_key_exists('if', $value) && ! $this->isCondition($value['if'])) {
                return false;
            }
            if (is_array($value['responsive'] ?? null)) {
                foreach ($value['responsive'] as $override) {
                    if (is_array($override) && array_key_exists('if', $override) && ! $this->isCondition($override['if'])) {
                        return false;
                    }
                }
            }
        }

        foreach ($value as $child) {
            if (! $this->targetConditionsAreSafe($child)) {
                return false;
            }
        }

        return true;
    }

    private function isCondition(mixed $condition): bool
    {
        return is_string($condition)
            && preg_match('/^\{\{\s*.+?\s*\}\}$/s', $condition) === 1;
    }

    private function decorateValue(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        if (array_is_list($value)) {
            $result = [];
            foreach ($value as $item) {
                $id = is_array($item) ? ($item['id'] ?? null) : null;
                if ($id === self::NATIVE_HEADER_IDS[0]) {
                    $result[] = $this->htmlNode('header');
                }
                if ($id === self::NATIVE_FOOTER_ID) {
                    $result[] = $this->htmlNode('footer');
                }
                $result[] = $this->decorateValue($item);
            }

            return $result;
        }

        $result = [];
        foreach ($value as $key => $child) {
            $result[$key] = $this->decorateValue($child);
        }

        $id = $result['id'] ?? null;
        if (is_string($id) && in_array($id, [...self::NATIVE_HEADER_IDS, self::NATIVE_FOOTER_ID], true)) {
            $result = $this->gateNativeNode($result);
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $node
     * @return array<string, mixed>
     */
    private function gateNativeNode(array $node): array
    {
        $node['if'] = $this->combineCondition($node['if'] ?? null);
        if (! is_array($node['responsive'] ?? null)) {
            return $node;
        }

        foreach ($node['responsive'] as $breakpoint => $override) {
            if (! is_array($override) || ! array_key_exists('if', $override)) {
                continue;
            }
            $override['if'] = $this->combineCondition($override['if']);
            $node['responsive'][$breakpoint] = $override;
        }

        return $node;
    }

    private function combineCondition(mixed $condition): string
    {
        $nativeFallback = '!'.self::ENABLED_EXPRESSION;
        if ($condition === null || $condition === '') {
            return '{{'.$nativeFallback.'}}';
        }
        if (! is_string($condition)
            || preg_match('/^\{\{\s*(.*?)\s*\}\}$/s', $condition, $matches) !== 1
            || trim($matches[1]) === '') {
            throw new \LogicException('Native template condition was not validated.');
        }

        return '{{('.trim($matches[1]).') && '.$nativeFallback.'}}';
    }

    /** @return array<string, mixed> */
    private function dataSource(): array
    {
        return [
            'id' => self::DATA_SOURCE_ID,
            'type' => 'api',
            'endpoint' => '/api/modules/jiwonpapa-page_builder/public/site-shell?locale={{$locale}}',
            'method' => 'GET',
            'auto_fetch' => true,
            'auth_required' => false,
            'loading_strategy' => 'blocking',
            'fallback' => [
                'data' => [
                    'shell' => [
                        'enabled' => false,
                        'header_html' => '',
                        'footer_html' => '',
                    ],
                ],
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function htmlNode(string $kind): array
    {
        $field = $kind.'_html';

        return [
            'id' => $kind === 'header' ? self::BUILDER_HEADER_ID : self::BUILDER_FOOTER_ID,
            'type' => 'composite',
            'name' => 'HtmlContent',
            'if' => '{{'.self::ENABLED_EXPRESSION.' && g7pb_site_shell?.data?.shell?.'.$field.'}}',
            'props' => [
                'content' => '{{g7pb_site_shell?.data?.shell?.'.$field." ?? ''}}",
                'isHtml' => true,
                'className' => 'g7pb-global-site-shell g7pb-global-site-shell--'.$kind,
            ],
        ];
    }
}
