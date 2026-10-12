<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3;

use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use stdClass;

/** Independent draft preview fragment, not a stored publication or G7 compiler replacement. */
final readonly class DraftRenderer
{
    public function __construct(private Validator $validator) {}

    public function render(string $json, string $viewport = 'base'): string
    {
        $document = $this->validator->validateJson($json);
        // Validate the viewport even for empty documents.
        $this->validator::effectiveStyle((object) ['style' => new stdClass, 'responsive' => new stdClass], $viewport);
        $styles = Presentation::document($document, $viewport, $this->validator->semanticDisplays());
        $behavior = BehaviorPresentation::apply($document, $styles, $viewport);

        return (new ElementMarkup)->render($document, $behavior['styles'], $behavior['attributes']);
    }
}
