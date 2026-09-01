import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editorCss = readFileSync(resolve('resources/css/page-builder-editor.css'), 'utf8');
const paritySpec = readFileSync(resolve('tests/E2E/editorLayoutParity.spec.ts'), 'utf8');

describe('hero slider rich editor box parity', () => {
  it('uses a bounded proportional media tolerance instead of layout padding', () => {
    expect(editorCss).not.toContain('padding-bottom: calc(clamp(2rem, 6vw, 5rem) + .15rem)');
    expect(paritySpec).toContain('Math.max(1.25, Math.max(media.width, media.height) * 0.005)');
  });
});
