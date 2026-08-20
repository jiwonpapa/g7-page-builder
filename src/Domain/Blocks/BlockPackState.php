<?php

namespace Modules\Jiwonpapa\PageBuilder\Domain\Blocks;

enum BlockPackState: string
{
    case Staged = 'staged';
    case Enabled = 'enabled';
    case Disabled = 'disabled';
    case Retired = 'retired';
    case Quarantined = 'quarantined';

    public function canTransitionTo(self $next): bool
    {
        if ($this === $next) {
            return true;
        }

        return match ($this) {
            self::Staged => in_array($next, [self::Enabled, self::Disabled, self::Quarantined], true),
            self::Enabled => in_array($next, [self::Disabled, self::Quarantined], true),
            self::Disabled => in_array($next, [self::Enabled, self::Retired, self::Quarantined], true),
            self::Retired => $next === self::Quarantined,
            self::Quarantined => $next === self::Staged,
        };
    }
}
