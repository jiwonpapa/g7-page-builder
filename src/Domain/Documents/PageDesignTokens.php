<?php

declare(strict_types=1);

namespace Modules\Jiwonpapa\PageBuilder\Domain\Documents;

/** The PHP source of truth for page-level design token names, options and defaults. */
final readonly class PageDesignTokens
{
    /** @var array<string, string> */
    public const DEFAULTS = [
        'design.color_mode' => 'light',
        'design.palette' => 'indigo',
        'design.font' => 'modern',
        'design.radius' => 'soft',
        'design.width' => 'standard',
        'design.scale' => 'balanced',
    ];

    /** @var array<string, list<string>> */
    public const OPTIONS = [
        'design.color_mode' => ['light', 'dark', 'system'],
        'design.palette' => ['indigo', 'blue', 'emerald', 'amber', 'rose', 'slate'],
        'design.font' => ['system', 'modern', 'serif'],
        'design.radius' => ['sharp', 'soft', 'round'],
        'design.width' => ['narrow', 'standard', 'wide'],
        'design.scale' => ['compact', 'balanced', 'large'],
    ];

    /** @var array<string, string> */
    public const CUSTOM_COLOR_DEFAULTS = [
        'design.custom_color_1_light' => '#2456df',
        'design.custom_color_1_dark' => '#8ba7ff',
        'design.custom_color_2_light' => '#059669',
        'design.custom_color_2_dark' => '#6ee7b7',
        'design.custom_color_3_light' => '#d97706',
        'design.custom_color_3_dark' => '#fbbf24',
        'design.custom_color_4_light' => '#e11d48',
        'design.custom_color_4_dark' => '#fda4af',
    ];

    /** @param array<string, string|int|float|bool|null> $values */
    private function __construct(private array $values) {}

    /** @param array<mixed> $values */
    public static function fromArray(array $values): self
    {
        return new self(self::validatedValues($values, self::OPTIONS, self::CUSTOM_COLOR_DEFAULTS));
    }

    /**
     * Recover historical values without changing the stored document. Only the
     * recently introduced color checks differ; writes and compilation revalidate.
     *
     * @param  array<mixed>  $values
     */
    public static function fromStoredArray(array $values): self
    {
        return new self(self::validatedValues($values, array_diff_key(self::OPTIONS, ['design.color_mode' => true]), []));
    }

    /** @return array<string, string|int|float|bool|null> */
    public function toArray(): array
    {
        return $this->values;
    }

    /**
     * @param  array<mixed>  $values
     * @param  array<string, list<string>>  $options
     * @param  array<string, string>  $customColors
     * @return array<string, string|int|float|bool|null>
     */
    private static function validatedValues(array $values, array $options, array $customColors): array
    {
        $validated = [];
        foreach ($values as $name => $value) {
            if (! is_string($name) || (! is_scalar($value) && $value !== null)) {
                throw new \InvalidArgumentException('Page token value is invalid.');
            }
            $validated[$name] = $value;
            // Preserve the legacy compiler's treatment of null color mode as unset.
            if ($name === 'design.color_mode' && $value === null) {
                continue;
            }
            if (isset($options[$name])
                && (! is_string($value) || ! in_array($value, $options[$name], true))) {
                throw new \InvalidArgumentException("Page design token {$name} is invalid.");
            }
            if (isset($customColors[$name])
                && $value !== null
                && (! is_string($value) || preg_match('/^#[0-9a-f]{6}$/iD', $value) !== 1)) {
                throw new \InvalidArgumentException("Page design token {$name} is invalid.");
            }
        }

        return $validated;
    }

    /** @return array<string, string> */
    public function presets(): array
    {
        $resolved = [];
        foreach (self::DEFAULTS as $name => $default) {
            $value = $this->values[$name] ?? $default;
            if (! is_string($value) || ! in_array($value, self::OPTIONS[$name], true)) {
                throw new \InvalidArgumentException("Page design token {$name} is invalid.");
            }
            $resolved[$name] = $value;
        }

        return $resolved;
    }

    /** @return array<string, string>|null */
    public function customPalette(): ?array
    {
        if (array_intersect_key($this->values, self::CUSTOM_COLOR_DEFAULTS) === []) {
            return null;
        }
        $resolved = [];
        foreach (self::CUSTOM_COLOR_DEFAULTS as $name => $default) {
            $value = $this->values[$name] ?? $default;
            if (! is_string($value) || preg_match('/^#[0-9a-f]{6}$/iD', $value) !== 1) {
                throw new \InvalidArgumentException("Page design token {$name} is invalid.");
            }
            $resolved[$name] = strtolower($value);
        }

        return $resolved;
    }
}
