import type { CSSProperties } from 'react';
import type { Declarations } from '../../documents/v3/presentation';
export function reactStyle(declarations: Declarations): CSSProperties {
  // Puck appends backgroundColor to its slot style. Mixing that longhand with
  // a background shorthand clears the authored color in React's style update.
  // These are validated/generated declarations, never authored raw CSS.
  return { backgroundColor: 'transparent', ...Object.fromEntries(Object.entries(declarations).map(([key, value]) => [
    key === 'background' ? (value.startsWith('linear-gradient(') ? 'backgroundImage' : 'backgroundColor')
      : key.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase()), value,
  ])) };
}
