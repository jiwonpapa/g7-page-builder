<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Publishing;

final readonly class PreviewTicket
{
    public function __construct(
        public string $token,
        public \DateTimeImmutable $expiresAt,
    ) {}
}
