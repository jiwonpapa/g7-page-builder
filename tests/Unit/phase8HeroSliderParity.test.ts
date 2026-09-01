import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const catalogSource = readFileSync(resolve('resources/js/editor/catalogBlocks.tsx'), 'utf8');

describe('hero slider editor parity', () => {
  it('keeps every slide in layout while presenting the selected slide first', () => {
    expect(catalogSource).toContain('style={{ order: index === activeIndex ? -1 : index }}');
    expect(catalogSource).not.toContain('hidden={activeIndex !== index}');
  });
});
