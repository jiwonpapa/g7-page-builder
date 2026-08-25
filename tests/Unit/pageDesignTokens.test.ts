import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PAGE_DESIGN,
  pageDesignClassName,
  pageDesignToTokens,
  tokensToPageDesign,
} from '../../resources/js/editor/pageDesignTokens';

describe('page design tokens', () => {
  it('normalizes missing and invalid values to safe presets', () => {
    expect(tokensToPageDesign({
      'design.palette': 'javascript:alert(1)',
      'design.radius': 300,
    })).toEqual(DEFAULT_PAGE_DESIGN);
  });

  it('preserves unrelated extension tokens while writing owned design presets', () => {
    expect(pageDesignToTokens({
      palette: 'emerald', font: 'serif', radius: 'round', width: 'wide', scale: 'large',
    }, { 'pack.vendor.option': true })).toEqual({
      'pack.vendor.option': true,
      'design.palette': 'emerald',
      'design.font': 'serif',
      'design.radius': 'round',
      'design.width': 'wide',
      'design.scale': 'large',
    });
  });

  it('emits only allowlisted deterministic classes', () => {
    expect(pageDesignClassName({
      palette: 'rose', font: 'system', radius: 'sharp', width: 'narrow', scale: 'compact',
    })).toBe('g7pb-document-theme g7pb-theme-mode-light g7pb-theme-palette-rose g7pb-theme-font-system g7pb-theme-radius-sharp g7pb-theme-width-narrow g7pb-theme-scale-compact g7pb-theme-custom-palette');
  });
});
