<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Compilation;

final class DocumentCompileException extends \RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode = 'G7PB_COMPILE_FAILED',
    ) {
        parent::__construct($message);
    }
}
