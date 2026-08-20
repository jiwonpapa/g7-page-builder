<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

final class BlockPackInUseException extends \DomainException
{
    public function __construct(public readonly BlockPackUsage $usage)
    {
        parent::__construct('문서 또는 리비전에서 사용하는 블록 팩은 제거할 수 없습니다. 먼저 해당 블록을 교체해 주세요.');
    }
}
