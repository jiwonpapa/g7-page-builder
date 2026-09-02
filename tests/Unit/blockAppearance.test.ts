import { describe, expect, it } from 'vitest';

import type { BlockAppearance, ElementAppearance } from '../../resources/js/documents/blockPresentation';
import {
  blockContainerEditorProps,
  mergeBlockContainerAppearance,
  normalizeBlockAppearance,
} from '../../resources/js/editor/blockAppearance';

describe('block appearance input boundary', () => {
  it('replaces only container settings while preserving valid styles and extension keys', () => {
    const current = Object.freeze({
      surface: 'contrast', spacing: 'compact', textScale: 'balanced', textAlign: 'left',
      containerWidth: 'narrow', containerAlign: 'left', minHeight: 'medium', verticalAlign: 'end',
      elements: Object.freeze({
        title: Object.freeze({ font: 'inherit', size: 'base', weight: 'regular', align: 'left', tone: 'default', extension: 'retained' }),
        'items.0.title': Object.freeze({ font: 'serif', fontSizeRem: 1.125, weight: 'bold', align: 'center', tone: 'custom4' }),
        empty: Object.freeze({}),
      }),
      extension: Object.freeze({ retained: true }),
    });
    const before = structuredClone(current);
    const editor = Object.freeze({ containerWidth: 'wide', containerAlign: 'stretch', minHeight: 'viewport', verticalAlign: 'center' });

    expect(mergeBlockContainerAppearance(current, editor)).toEqual({ ...before, ...editor });
    expect(current).toEqual(before);
  });

  it('removes inherited container defaults without manufacturing an empty appearance', () => {
    const editor = { containerWidth: 'inherit', containerAlign: 'center', minHeight: 'auto', verticalAlign: 'start' };
    expect(mergeBlockContainerAppearance(undefined, editor)).toBeUndefined();
    expect(mergeBlockContainerAppearance({}, editor)).toBeUndefined();
    expect(mergeBlockContainerAppearance({ containerWidth: 'wide', minHeight: 'large' }, editor)).toBeUndefined();
    expect(mergeBlockContainerAppearance({ surface: 'soft', spacing: 'spacious', elements: {} }, editor))
      .toEqual({ surface: 'soft', spacing: 'spacious', elements: {} });
  });

  it('derives required settings only from permitted values when adding a container override', () => {
    expect(mergeBlockContainerAppearance(undefined, { containerWidth: 'wide', surface: 'soft', spacing: 'spacious' }))
      .toEqual({ surface: 'soft', spacing: 'spacious', containerWidth: 'wide' });
    expect(mergeBlockContainerAppearance({ surface: 'not-a-surface', spacing: 'not-a-spacing' }, { surface: 'soft', spacing: 'spacious' }))
      .toEqual({ surface: 'soft', spacing: 'spacious' });
    expect(mergeBlockContainerAppearance({ surface: true, spacing: [] }, { surface: 'unknown', spacing: 'unknown' }))
      .toEqual({ surface: 'default', spacing: 'normal' });
  });

  it('does not promote malformed known appearance fields into the declared result', () => {
    const invalid = Object.freeze({
      surface: 'contrast', spacing: 'compact', textScale: 'huge', textAlign: ['right'],
      containerWidth: 'unknown', containerAlign: 7, minHeight: false, verticalAlign: null,
      elements: {
        title: { font: 'unknown', fontSizeRem: Number.NaN, size: 'huge', weight: 900, align: 'justify', tone: '#fff', extension: true },
        subtitle: { fontSizeRem: 1.3, weight: 'bold' },
        action: { fontSizeRem: 1.5, size: 'large' },
        invalid: ['bold'], missing: null,
      },
      extension: 'retained',
    });
    const before = structuredClone(invalid);
    expect(mergeBlockContainerAppearance(invalid, invalid)).toEqual({
      surface: 'contrast', spacing: 'compact',
      elements: { title: { extension: true }, subtitle: { weight: 'bold' }, action: { fontSizeRem: 1.5 } },
      extension: 'retained',
    });
    expect(invalid).toEqual(before);
  });

  it.each([null, false, 1, 'wide', []])('does not treat %j as an appearance record', (value) => {
    expect(mergeBlockContainerAppearance(value, {})).toBeUndefined();
    expect(blockContainerEditorProps(value)).toEqual({
      containerWidth: 'inherit', containerAlign: 'center', minHeight: 'auto', verticalAlign: 'start',
    });
  });

  it.each([null, false, 'bold', [], 42])('omits a malformed elements map %j while retaining the block settings', (elements) => {
    expect(mergeBlockContainerAppearance({ surface: 'soft', spacing: 'normal', elements }, {}))
      .toEqual({ surface: 'soft', spacing: 'normal' });
  });

  it('preserves all supported element presets, including explicit legacy defaults', () => {
    const styles: ElementAppearance[] = [
      { font: 'inherit', size: 'small', weight: 'regular', align: 'left', tone: 'default' },
      { font: 'system', size: 'base', weight: 'medium', align: 'center', tone: 'muted' },
      { font: 'modern', size: 'large', weight: 'semibold', align: 'right', tone: 'accent' },
      { font: 'serif', size: 'xlarge', weight: 'bold', tone: 'contrast' },
      { font: 'mono', tone: 'custom1' }, { tone: 'custom2' }, { tone: 'custom3' }, { tone: 'custom4' },
    ];
    for (const style of styles) {
      const current: BlockAppearance = { surface: 'default', spacing: 'normal', elements: { title: style } };
      expect(mergeBlockContainerAppearance(current, {})).toEqual(current);
    }
  });

  it('keeps normalization defaults distinct from lossless merging of valid explicit text defaults', () => {
    const current: BlockAppearance = { surface: 'soft', spacing: 'spacious', textScale: 'balanced', textAlign: 'left' };
    expect(normalizeBlockAppearance(current, { surface: 'default', spacing: 'normal' }))
      .toEqual({ surface: 'soft', spacing: 'spacious' });
    expect(mergeBlockContainerAppearance(current, {})).toEqual(current);
  });
});
