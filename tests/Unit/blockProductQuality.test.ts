import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import manifestSource from '../../resources/block-packs/builtin-core/manifest.json';
import indexSource from '../../resources/block-packs/builtin-core/thumbnails/generated/index.json';
import qualitySource from '../../resources/block-packs/builtin-core/product-quality.json';
import schema from '../../schemas/block-product-quality.schema.json';
// @ts-expect-error The release checker is an executable ESM script exercised directly by this contract test.
import { validateBlockProductQuality } from '../../scripts/check-block-product-quality.mjs';

const root = resolve('.');
const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

function clone<T>(value: T): T {
  return structuredClone(value);
}

function approvedQuality(manifest = clone(manifestSource), index = clone(indexSource)) {
  const quality = clone(qualitySource);
  const candidate = validateBlockProductQuality({
    root,
    manifest,
    index,
    quality,
    packageJson,
    candidate: true,
  });
  expect(candidate.errors).toEqual([]);
  quality.approval.catalog_digest = candidate.digest;
  quality.approval.decision = 'approved';
  quality.approval.findings = [];
  Object.keys(quality.approval.criteria).forEach((criterion) => {
    quality.approval.criteria[criterion as keyof typeof quality.approval.criteria] = 'pass';
  });
  return quality;
}

describe('built-in block product quality gate', () => {
  it('validates the versioned quality and review contract', () => {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    expect(validate(qualitySource), JSON.stringify(validate.errors)).toBe(true);
  });

  it('accepts the exact reviewed catalog and release wiring', () => {
    const quality = approvedQuality();
    const result = validateBlockProductQuality({
      root,
      manifest: clone(manifestSource),
      index: clone(indexSource),
      quality,
      packageJson,
      release: true,
    });
    expect(result.items).toHaveLength(140);
    expect(result.errors).toEqual([]);
  });

  it('rejects placeholder copy and exact preset duplication', () => {
    const manifest = clone(manifestSource);
    const headingPresets = manifest.presets.filter((preset) => preset.block_id === 'content.heading-01');
    headingPresets[0]!.props.heading = '제목을 입력해주세요';
    headingPresets[1]!.props = clone(headingPresets[0]!.props);
    const result = validateBlockProductQuality({
      root,
      manifest,
      index: clone(indexSource),
      quality: approvedQuality(),
      packageJson,
      candidate: true,
    });
    expect(result.errors.join('\n')).toContain('placeholder 문구');
    expect(result.errors.join('\n')).toContain('완전히 중복');
  });

  it('rejects unreviewed blocks and internal layout names in image alt text', () => {
    const manifest = clone(manifestSource);
    const hero = manifest.presets.find((preset) => preset.preset_id === 'hero.poster');
    if (!hero || !('image' in hero.props)) throw new Error('hero.poster fixture is missing.');
    (hero.props.image as { alt: string }).alt = 'poster 히어로 대표 이미지';
    const quality = approvedQuality();
    delete (quality.contract.block_policies as Record<string, unknown>)['content.heading-01'];
    const result = validateBlockProductQuality({
      root,
      manifest,
      index: clone(indexSource),
      quality,
      packageJson,
      candidate: true,
    });
    expect(result.errors.join('\n')).toContain('정확히 하나의 제품 품질 정책');
    expect(result.errors.join('\n')).toContain('내부 layout 이름');
  });

  it('invalidates approval and renderer freshness when any generated source changes', () => {
    const quality = approvedQuality();
    const staleApproval = clone(quality);
    staleApproval.approval.catalog_digest = 'a'.repeat(64);
    const approvalResult = validateBlockProductQuality({
      root,
      manifest: clone(manifestSource),
      index: clone(indexSource),
      quality: staleApproval,
      packageJson,
    });
    expect(approvalResult.errors.join('\n')).toContain('제품 검토 승인이 현재 생성물과 다릅니다');

    const freshSources = clone(indexSource.sources);
    const firstCatalogId = Object.keys(freshSources)[0]!;
    freshSources[firstCatalogId as keyof typeof freshSources] = 'b'.repeat(64);
    const freshnessResult = validateBlockProductQuality({
      root,
      manifest: clone(manifestSource),
      index: clone(indexSource),
      quality,
      packageJson,
      candidate: true,
      verifyRenderSource: true,
      freshSources,
      freshDynamicSamples: clone(indexSource.dynamic_samples),
    });
    expect(freshnessResult.errors.join('\n')).toContain('현재 props/compiler/CSS보다 오래되었습니다');
  });

  it('rejects blank G7 dynamic previews even when their source hash exists', () => {
    const index = clone(indexSource);
    const dynamicCatalogId = Object.keys(index.dynamic_samples)[0]!;
    index.dynamic_samples[dynamicCatalogId as keyof typeof index.dynamic_samples] = 0;
    const result = validateBlockProductQuality({
      root,
      manifest: clone(manifestSource),
      index,
      quality: approvedQuality(),
      packageJson,
      candidate: true,
    });
    expect(result.errors.join('\n')).toContain('동적 미리보기 항목이 부족합니다');
  });

  it('checks technical quality without approving or rewriting a stale legacy review', () => {
    const quality = clone(qualitySource);
    quality.approval.catalog_digest = 'a'.repeat(64);
    quality.approval.decision = 'rejected';
    const original = clone(quality);
    const result = validateBlockProductQuality({
      root, manifest: clone(manifestSource), index: clone(indexSource), quality, packageJson,
      technical: true, verifyRenderSource: true,
      freshSources: clone(indexSource.sources), freshDynamicSamples: clone(indexSource.dynamic_samples),
    });
    expect(result.errors).toEqual([]);
    expect(result.approvalChecked).toBe(false);
    expect(quality).toEqual(original);
    expect(validateBlockProductQuality({
      root, manifest: clone(manifestSource), index: clone(indexSource), quality, packageJson,
    }).errors.join('\n')).toContain('제품 검토 승인이 현재 생성물과 다릅니다');
  });

  it('retains current CSS source, content and dynamic sample failures in technical mode', () => {
    const manifest = clone(manifestSource);
    manifest.presets.find(preset => preset.preset_id === 'hero.poster')!.props.heading = '제목을 입력해주세요';
    const freshSources = clone(indexSource.sources);
    const catalogId = Object.keys(freshSources)[0] as keyof typeof freshSources;
    freshSources[catalogId] = 'b'.repeat(64);
    const result = validateBlockProductQuality({
      root, manifest, index: clone(indexSource), quality: clone(qualitySource), packageJson,
      technical: true, verifyRenderSource: true, freshSources, freshDynamicSamples: {},
    });
    expect(result.errors.join('\n')).toContain('placeholder 문구');
    expect(result.errors.join('\n')).toContain('현재 props/compiler/CSS보다 오래되었습니다');
    expect(result.errors.join('\n')).toContain('동적 미리보기 샘플이 현재 fixture와 다릅니다');
  });

  it.each([
    { candidate: true, release: true },
    { technical: true, release: true },
    { candidate: true, technical: true },
  ])('rejects incompatible approval modes %j', (modes) => {
    const result = validateBlockProductQuality({
      root, manifest: clone(manifestSource), index: clone(indexSource), quality: approvedQuality(), packageJson,
      ...modes,
    });
    expect(result.errors.join('\n')).toContain('서로 함께 사용할 수 없습니다');
  });

  it('does not let technical mode drop source freshness or evidence checks from development wiring', () => {
    for (const key of ['check', 'test:unit', 'pretest:e2e:product']) {
      const changedPackage = clone(packageJson);
      changedPackage.scripts[key] = changedPackage.scripts[key].replace('npm run check:block-quality-evidence', 'true');
      const result = validateBlockProductQuality({
        root, manifest: clone(manifestSource), index: clone(indexSource), quality: clone(qualitySource),
        packageJson: changedPackage, technical: true,
      });
      expect(result.errors.join('\n')).toContain(`${key}가 기술 품질과 v2 증거 무결성`);
    }
  });
});
