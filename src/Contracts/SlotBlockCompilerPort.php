<?php

namespace Modules\Jiwonpapa\PageBuilder\Contracts;

/** Only trusted, recursively compiled children cross this boundary. */
interface SlotBlockCompilerPort extends BlockTypeCompilerPort
{
    /**
     * @param  array<string, mixed>  $props
     * @param  array<string, string>  $slots
     */
    public function compileSlots(array $props, array $slots): string;
}
