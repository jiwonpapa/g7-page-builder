import React from 'react';
import { compositionLibrary } from '../adapters/gnuboard7/compositionLibrary';
import { NativeCompositions } from './ui/compositions';
import type { NativeCompositionPanelProps } from './ports/compositions';
const library = compositionLibrary();
/** Optional UI chunk; no registration, second host or document state. */
export function NativeCompositionPanel({ host }: NativeCompositionPanelProps): React.ReactElement {
  return <NativeCompositions host={host} library={library} />;
}

