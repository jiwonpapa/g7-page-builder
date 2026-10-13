<?php

namespace Modules\Jiwonpapa\PageBuilder\Infrastructure\Gnuboard7\Http;

use Illuminate\Http\Request;
use stdClass;

/** Preserve the JSON object/list distinction at both single and set API edges. */
final class SitePartDocumentInput
{
    /** @return array<string, mixed>|string */
    public static function read(Request $request, ?string $kind = null): array|string
    {
        if ($kind !== null && ! in_array($kind, ['header', 'footer'], true)) {
            throw new \InvalidArgumentException('Site Part input kind is invalid.');
        }
        $key = $kind === null ? 'document' : $kind.'.document';
        $payload = $request->input($key);
        if (! is_array($payload)) {
            throw new \InvalidArgumentException('Site Part document is required.');
        }
        if (($payload['schema_version'] ?? null) !== 'g7-page-builder/site-part/v2') {
            return $payload;
        }
        try {
            $body = json_decode($request->getContent(), flags: JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new \InvalidArgumentException('Element Site Parts require a JSON request body.', previous: $error);
        }
        if (! $body instanceof stdClass) {
            throw new \InvalidArgumentException('Site Part request must be a JSON object.');
        }
        $owner = $kind === null ? $body : ($body->{$kind} ?? null);
        if (! $owner instanceof stdClass || ! ($owner->document ?? null) instanceof stdClass) {
            throw new \InvalidArgumentException('Site Part document must be a JSON object.');
        }

        return json_encode($owner->document, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }
}
