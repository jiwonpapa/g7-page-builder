import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editorCss = readFileSync(resolve('resources/css/page-builder-editor.css'), 'utf8');

describe('Phase 8 heading wrapping parity', () => {
  it('keeps the public word-break policy inside matching editable heading descendants', () => {
    expect(editorCss).toContain('.g7pb-preview-hero [data-g7pb-heading-level="1"] *');
    expect(editorCss).toContain('.g7pb-preview-hero-slider [data-g7pb-heading-level="2"] *');
    expect(editorCss).not.toContain('.g7pb-preview-hero-split [data-g7pb-heading-level="1"] *');
    expect(editorCss).toMatch(/heading-level="2"\]\s+\*\s*\{[^}]*word-break:\s*keep-all/);
  });
});
