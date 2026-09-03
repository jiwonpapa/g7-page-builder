<?php

namespace Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocument;

use Modules\Jiwonpapa\PageBuilder\Application\Compilation\RichTextSanitizer;
use Modules\Jiwonpapa\PageBuilder\Domain\Compilation\DocumentCompileException;

final readonly class BlockPropertyReader
{
    public function __construct(private RichTextSanitizer $richText) {}

    /**
     * @param  array<string, mixed>  $values
     */
    public function requiredString(array $values, string $key, int $maxLength): string
    {
        $value = $values[$key] ?? null;

        if (! is_string($value) || trim($value) === '') {
            throw new DocumentCompileException($this->requiredFieldMessage($key));
        }
        if (mb_strlen($value) > $maxLength) {
            throw new DocumentCompileException($this->fieldLengthMessage($key, $maxLength));
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function optionalString(array $values, string $key, int $maxLength): ?string
    {
        $value = $values[$key] ?? null;

        if ($value === null) {
            return null;
        }

        if (! is_string($value) || mb_strlen($value) > $maxLength) {
            throw new DocumentCompileException("Property {$key} must be a string within its length limit.");
        }

        return $value;
    }

    /** @param array<string, mixed> $values */
    public function requiredInlineRichTextString(
        array $values,
        string $key,
        int $maxLength,
        bool $allowLinks = true,
    ): string {
        return $this->requiredInlineRichTextValue(
            $values[$key] ?? null,
            "Property {$key}",
            $maxLength,
            $allowLinks,
        );
    }

    /** @param array<string, mixed> $values */
    public function optionalInlineRichTextString(
        array $values,
        string $key,
        int $maxLength,
        bool $allowLinks = true,
    ): ?string {
        $value = $values[$key] ?? null;
        if ($value === null) {
            return null;
        }
        if (! is_string($value)) {
            throw new DocumentCompileException("Property {$key} must be a string within its length limit.");
        }

        $this->assertPromotedRichTextLength($value, $maxLength, inline: true, allowLinks: $allowLinks);

        return $value;
    }

    /** @param array<string, mixed> $values */
    public function requiredRichTextString(array $values, string $key, int $maxLength): string
    {
        $value = $values[$key] ?? null;
        if (! is_string($value)) {
            throw new DocumentCompileException($this->requiredFieldMessage($key));
        }

        $this->assertPromotedRichTextLength($value, $maxLength, required: true, property: $key);

        return $value;
    }

    /** @param array<string, mixed> $values */
    public function optionalRichTextString(array $values, string $key, int $maxLength): ?string
    {
        $value = $values[$key] ?? null;
        if ($value === null) {
            return null;
        }
        if (! is_string($value)) {
            throw new DocumentCompileException("Property {$key} must be a string within its length limit.");
        }

        $this->assertPromotedRichTextLength($value, $maxLength);

        return $value;
    }

    public function requiredInlineRichTextValue(
        mixed $value,
        string $property,
        int $maxLength,
        bool $allowLinks = true,
    ): string {
        if (! is_string($value)) {
            throw new DocumentCompileException("{$property} is invalid.");
        }

        $this->assertPromotedRichTextLength(
            $value,
            $maxLength,
            required: true,
            inline: true,
            allowLinks: $allowLinks,
        );

        return $value;
    }

    private function assertPromotedRichTextLength(
        string $value,
        int $maxLength,
        bool $required = false,
        bool $inline = false,
        bool $allowLinks = true,
        ?string $property = null,
    ): void {
        $plainText = $this->richText->promotedRichTextPlainText($value, $inline, $allowLinks);
        if ($required && trim($plainText) === '') {
            throw new DocumentCompileException($this->requiredFieldMessage($property ?? 'content'));
        }
        if (mb_strlen($plainText) > $maxLength) {
            throw new DocumentCompileException($this->fieldLengthMessage($property ?? 'content', $maxLength));
        }
    }

    private function requiredFieldMessage(string $key): string
    {
        return '필수 항목 “'.$this->fieldLabel($key).'”를 입력해야 합니다.';
    }

    private function fieldLengthMessage(string $key, int $maxLength): string
    {
        return '“'.$this->fieldLabel($key).'” 입력은 '.$maxLength.'자 이내여야 합니다.';
    }

    private function fieldLabel(string $key): string
    {
        return match ($key) {
            'alt', 'imageAlt', 'avatarAlt' => '이미지 대체 텍스트',
            'title', 'heading' => '제목',
            'content', 'body', 'answer', 'description', 'summary' => '본문',
            'label', 'buttonLabel', 'submitLabel', 'directionsLabel', 'linkLabel', 'currentLabel' => '표시 문구',
            'url', 'buttonUrl', 'directionsUrl', 'detailUrl', 'detailBasePath' => '연결 주소',
            'src' => '이미지',
            'address' => '주소',
            'phone' => '전화번호',
            'email' => '이메일',
            'date' => '날짜',
            'name' => '이름',
            'role' => '역할',
            'quote' => '인용문',
            'citation' => '출처',
            'videoId' => '영상 ID',
            'productKey' => '상품 식별자',
            'boardSlug' => '게시판 식별자',
            default => $key,
        };
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function requiredBoolean(array $values, string $key): bool
    {
        $value = $values[$key] ?? null;

        if (! is_bool($value)) {
            throw new DocumentCompileException("Property {$key} must be a boolean.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function requiredNumber(array $values, string $key, float $minimum, float $maximum): float
    {
        $value = $values[$key] ?? null;

        if ((! is_int($value) && ! is_float($value)) || ! is_finite((float) $value)) {
            throw new DocumentCompileException("Property {$key} must be a finite number.");
        }

        $number = (float) $value;
        if ($number < $minimum || $number > $maximum) {
            throw new DocumentCompileException("Property {$key} is outside the allowed range.");
        }

        return $number;
    }

    /**
     * @param  array<string, mixed>  $values
     * @param  list<int>  $choices
     */
    public function requiredIntegerChoice(array $values, string $key, array $choices): int
    {
        $value = $values[$key] ?? null;
        if (! is_int($value) || ! in_array($value, $choices, true)) {
            throw new DocumentCompileException("Property {$key} is invalid.");
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>|null
     */
    public function optionalMap(array $values, string $key): ?array
    {
        $value = $values[$key] ?? null;

        if ($value === null) {
            return null;
        }

        if (! is_array($value)) {
            throw new DocumentCompileException("Property {$key} must be an object.");
        }

        return $value;
    }

    /**
     * @param  array<array-key, mixed>  $values
     * @param  list<string>  $allowedKeys
     */
    public function assertOnlyKeys(array $values, array $allowedKeys, string $property): void
    {
        foreach (array_keys($values) as $key) {
            if (! is_string($key) || ! in_array($key, $allowedKeys, true)) {
                throw new DocumentCompileException("{$property} contains an unsupported property.");
            }
        }
    }
}
