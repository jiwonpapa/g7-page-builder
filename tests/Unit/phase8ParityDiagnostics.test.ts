import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const spec = readFileSync(resolve('tests/E2E/editorLayoutParity.spec.ts'), 'utf8');

describe('Phase 8 layout parity diagnostics', () => {
  it('records the computed line-wrapping contract for editor and preview text', () => {
    for (const property of ['letterSpacing', 'overflowWrap', 'whiteSpace', 'wordBreak']) {
      expect(spec).toContain(`${property}: style.${property}`);
      expect(spec).toContain(`${property}: childStyle.${property}`);
    }
  });
});
