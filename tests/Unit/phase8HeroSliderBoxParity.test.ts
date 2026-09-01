import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editorCss = readFileSync(resolve('resources/css/page-builder-editor.css'), 'utf8');

describe('hero slider rich editor box parity', () => {
  it('accounts for the rich editor wrapper without changing compiled content', () => {
    expect(editorCss).toContain('.g7pb-preview-hero-slider article > .g7pb-preview-hero-slider__copy { padding-bottom: calc(clamp(2rem, 6vw, 5rem) + .15rem); }');
  });
});
