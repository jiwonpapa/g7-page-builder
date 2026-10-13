<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use stdClass;

/** Fixed inquiry capability projected onto ordinary authored elements. */
final readonly class FormMarkup
{
    /** @param array<string, array<string, mixed>> $fields */
    public function __construct(private array $fields) {}

    /** @param list<stdClass> $nodes
     * @param  array<string, array<string, string>>  $attributes
     * @return array<string, array<string, string>>
     */
    public function attributes(array $nodes, array $attributes): array
    {
        foreach ($nodes as $node) {
            if (isset($node->binding)) {
                foreach ($node->binding->fields as $field) {
                    $rule = $this->fields[$field->name] ?? throw new \InvalidArgumentException('form_policy');
                    $attributes[$field->label_id]['for'] = 'node-'.$field->input_id;
                    $attributes[$field->input_id] = array_replace($attributes[$field->input_id] ?? [], [
                        'name' => $field->name, 'aria-labelledby' => 'node-'.$field->label_id,
                        ...$rule['required'] ? ['required' => ''] : [],
                        ...isset($rule['max_length']) ? ['maxlength' => (string) $rule['max_length']] : [],
                        ...isset($rule['autocomplete']) ? ['autocomplete' => $rule['autocomplete']] : [],
                        ...$rule['kind'] === 'checkbox' ? ['value' => '1'] : [],
                    ]);
                }
                $attributes[$node->binding->submit_id]['data-g7pb-form-submit'] = '';
                $attributes[$node->binding->status_id] = array_replace($attributes[$node->binding->status_id] ?? [], [
                    'data-g7pb-form-status' => '', 'role' => 'status', 'aria-live' => 'polite',
                ]);
            }
            $attributes = $this->attributes($node->slots->content ?? [], $attributes);
        }

        return $attributes;
    }

    /** Native input defaults must inherit typography at every unassigned viewport.
     * @param  array<string, string>  $styles
     * @return array<string, string>
     */
    public static function styles(stdClass $node, array $styles): array
    {
        if ($node->type === 'form.control') {
            foreach (['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color'] as $key) {
                $styles[$key] = array_key_exists('--g7pb-v3-base-'.$key, $styles)
                    ? 'var(--g7pb-v3-current-'.$key.', inherit)' : ($styles[$key] ?? 'inherit');
            }
        }
        if ($node->type === 'form.label') {
            $styles['white-space'] = 'pre-wrap';
        }

        return $styles;
    }

    public static function wrap(stdClass $host, stdClass $document, string $body, bool $publication): string
    {
        if (! isset($host->binding) || ! $publication) {
            return $body;
        }
        $binding = $host->binding;
        $hidden = '';
        foreach (['form_kind' => $binding->form_kind, 'block_instance_id' => $host->instance_id, 'started_at' => ''] as $name => $value) {
            $hidden .= '<span data-g7pb-form-control="input" data-g7pb-control-type="hidden" data-g7pb-control-name="'.$name.'" data-g7pb-control-value="'.self::escape($value).'"></span>';
        }
        $hidden .= '<span style="display:none" aria-hidden="true"><span data-g7pb-form-control="input" data-g7pb-control-type="text" data-g7pb-control-name="website" data-g7pb-control-tabindex="-1" data-g7pb-control-autocomplete="off"></span></span>';

        return '<div style="display:contents" data-g7pb-inquiry-host="" data-g7pb-inquiry-form="" data-g7pb-v3-inquiry=""'
            .' data-block-id="'.$host->instance_id.'" data-g7pb-form-kind="'.$binding->form_kind.'"'
            .' data-g7pb-form-action="/pages/'.rawurlencode($document->slug).'/inquiries"'
            .' data-g7pb-success-message="'.self::escape($binding->success_message).'">'.$hidden.$body.'</div>';
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
