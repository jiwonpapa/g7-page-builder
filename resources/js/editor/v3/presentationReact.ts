import type { CSSProperties } from 'react';
import type { Declarations } from '../../documents/v3/presentation';
export function reactStyle(declarations: Declarations): CSSProperties {
  return Object.fromEntries(Object.entries(declarations).map(([key, value]) => [key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), value]));
}
