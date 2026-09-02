import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MANIFEST_PATH = 'resources/block-packs/builtin-core/manifest.json';
const GENERATED_INDEX_PATH = 'resources/block-packs/builtin-core/thumbnails/generated/index.json';
const QUALITY_PATH = 'resources/block-packs/builtin-core/product-quality.json';
const QUALITY_SCHEMA_PATH = 'schemas/block-product-quality.schema.json';
const STORE_PREVIEW_PREFIX = '/modules/jiwonpapa-page_builder/store/previews/';

function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

function json(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function flattenStrings(value, path = 'props', output = []) {
  if (typeof value === 'string') output.push({ path, value });
  else if (Array.isArray(value)) value.forEach((item, index) => flattenStrings(item, `${path}[${index}]`, output));
  else if (isRecord(value)) Object.entries(value).forEach(([key, item]) => flattenStrings(item, `${path}.${key}`, output));
  return output;
}

function collectPresentationValues(value, keys) {
  if (Array.isArray(value)) return value.map((item) => collectPresentationValues(item, keys));
  if (!isRecord(value)) return undefined;
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (keys.has(key)) output[key] = item;
    else {
      const nested = collectPresentationValues(item, keys);
      if (Array.isArray(nested) || (isRecord(nested) && Object.keys(nested).length > 0)) output[key] = nested;
    }
  }
  return output;
}

function validateImageObject(errors, root, presetId, value, path, internalAltPatterns) {
  if (!isRecord(value)) return;
  const pairs = [['src', 'alt'], ['imageSrc', 'imageAlt'], ['avatarSrc', 'avatarAlt']];
  for (const [sourceKey, altKey] of pairs) {
    const source = value[sourceKey];
    if (typeof source !== 'string' || source === '') continue;
    const alt = value[altKey];
    if (typeof alt !== 'string' || alt.trim().length < 2) {
      errors.push(`${presetId}:${path}.${altKey} 이미지가 있으면 의미 있는 대체 텍스트가 필요합니다.`);
      continue;
    }
    for (const pattern of internalAltPatterns) {
      if (new RegExp(pattern, 'iu').test(alt)) {
        errors.push(`${presetId}:${path}.${altKey}에 내부 layout 이름이 노출됩니다: ${alt}`);
      }
    }
    if (source.startsWith(STORE_PREVIEW_PREFIX)) {
      const asset = resolve(root, 'resources/store/dist/previews', basename(source));
      if (!existsSync(asset)) errors.push(`${presetId}:${path}.${sourceKey} 로컬 이미지가 없습니다: ${source}`);
    }
  }
  for (const [key, item] of Object.entries(value)) {
    if (Array.isArray(item)) item.forEach((child, index) => validateImageObject(errors, root, presetId, child, `${path}.${key}[${index}]`, internalAltPatterns));
    else if (isRecord(item)) validateImageObject(errors, root, presetId, item, `${path}.${key}`, internalAltPatterns);
  }
}

function validateDates(errors, presetId, value, path = 'props') {
  if (Array.isArray(value)) value.forEach((item, index) => validateDates(errors, presetId, item, `${path}[${index}]`));
  else if (isRecord(value)) {
    for (const [key, item] of Object.entries(value)) {
      const itemPath = `${path}.${key}`;
      if (typeof item === 'string' && key.toLowerCase().endsWith('date') && item !== '') {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(item);
        const timestamp = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : Number.NaN;
        const normalized = Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : '';
        if (normalized !== item) errors.push(`${presetId}:${itemPath}는 실제 YYYY-MM-DD 날짜여야 합니다: ${item}`);
      }
      validateDates(errors, presetId, item, itemPath);
    }
  }
}

function generatedCatalogItems(root, manifest, index) {
  const sourceMap = index.sources ?? {};
  const dynamicSamples = index.dynamic_samples ?? {};
  return [...manifest.blocks.map((block) => ({
    catalogId: `block:${block.block_id}@${block.block_version}`,
    blockId: block.block_id,
    thumbnail: block.thumbnail,
  })), ...manifest.presets.map((preset) => ({
    catalogId: `preset:${manifest.pack_id}:${preset.preset_id}`,
    blockId: preset.block_id,
    thumbnail: preset.thumbnail,
  }))].map((item) => {
    const thumbnailPath = resolve(root, 'resources/block-packs/builtin-core', item.thumbnail);
    return {
      ...item,
      sourceHash: sourceMap[item.catalogId],
      dynamicSampleCount: dynamicSamples[item.catalogId] ?? 0,
      thumbnailHash: existsSync(thumbnailPath) ? sha256(readFileSync(thumbnailPath)) : null,
      thumbnailPath,
    };
  });
}

export function productReviewDigest(contractVersion, items) {
  const body = items
    .map((item) => `${item.catalogId}\t${item.sourceHash ?? ''}\t${item.thumbnailHash ?? ''}`)
    .sort()
    .join('\n');
  return sha256(`${contractVersion}\n${body}\n`);
}

function freshRenderState(root) {
  const output = mkdtempSync(join(tmpdir(), 'g7pb-block-quality-'));
  try {
    const rendered = spawnSync('php', [resolve(root, 'scripts/render-block-thumbnail-fixtures.php'), output], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (rendered.status !== 0) {
      throw new Error(`현재 compiler 기반 썸네일 source를 계산하지 못했습니다.\n${rendered.stdout}${rendered.stderr}`);
    }
    const entries = json(resolve(output, 'index.json'));
    return {
      sources: Object.fromEntries(entries.map((item) => [item.catalog_id, item.source_hash])),
      dynamicSamples: Object.fromEntries(entries
        .filter((item) => item.dynamic_sample_count > 0)
        .map((item) => [item.catalog_id, item.dynamic_sample_count])),
    };
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

function validateWiring(errors, root, packageJson) {
  const scripts = packageJson.scripts ?? {};
  if (scripts['check:block-product-quality'] !== 'node scripts/check-block-product-quality.mjs') {
    errors.push('package.json에 고정된 check:block-product-quality 명령이 필요합니다.');
  }
  if (scripts['check:block-quality-evidence'] !== 'node scripts/check-block-quality-evidence.mjs') {
    errors.push('package.json에 고정된 check:block-quality-evidence 명령이 필요합니다.');
  }
  // Gate selection/order belongs to the Python controller's contract tests.
  // Independent unit runs and receipt-backed release wrappers must not embed
  // another full validation chain merely to satisfy this product checker.
  const generator = readFileSync(resolve(root, 'scripts/generate-block-thumbnails.mjs'), 'utf8');
  if (!/check-block-product-quality\.mjs[\s\S]*--candidate[\s\S]*--verify-render-source/.test(generator)) {
    errors.push('블록 썸네일 생성 직후 candidate 제품 품질 게이트를 실행해야 합니다.');
  }
}

export function validateBlockProductQuality({
  root,
  manifest,
  index,
  quality,
  packageJson,
  candidate = false,
  technical = false,
  release = false,
  verifyRenderSource = false,
  freshSources = null,
  freshDynamicSamples = null,
}) {
  const errors = [];
  if ([candidate, technical, release].filter(Boolean).length > 1) {
    errors.push('candidate, technical, release 모드는 서로 함께 사용할 수 없습니다.');
  }
  const contract = quality.contract;
  const approval = quality.approval;
  const policies = contract.block_policies;
  const blocks = manifest.blocks;
  const presets = manifest.presets;
  const activeBlocks = blocks.filter((block) => !block.capabilities.includes('editor.compatibility-only'));
  const compatibilityBlocks = blocks.filter((block) => block.capabilities.includes('editor.compatibility-only'));

  if (blocks.length !== contract.inventory.block_count) errors.push(`블록 수가 계약과 다릅니다: ${blocks.length}`);
  if (activeBlocks.length !== contract.inventory.active_block_count) errors.push(`활성 블록 수가 계약과 다릅니다: ${activeBlocks.length}`);
  if (presets.length !== contract.inventory.preset_count) errors.push(`프리셋 수가 계약과 다릅니다: ${presets.length}`);
  const compatibilityIds = compatibilityBlocks.map((block) => block.block_id).sort();
  if (JSON.stringify(compatibilityIds) !== JSON.stringify([...contract.inventory.compatibility_only_block_ids].sort())) {
    errors.push(`호환 전용 블록 목록이 계약과 다릅니다: ${compatibilityIds.join(', ')}`);
  }
  const blockIds = blocks.map((block) => block.block_id).sort();
  const policyIds = Object.keys(policies).sort();
  if (JSON.stringify(blockIds) !== JSON.stringify(policyIds)) errors.push('모든 블록은 정확히 하나의 제품 품질 정책을 가져야 합니다.');

  const presetsByBlock = new Map();
  for (const preset of presets) {
    const list = presetsByBlock.get(preset.block_id) ?? [];
    list.push(preset);
    presetsByBlock.set(preset.block_id, list);
  }
  for (const block of blocks) {
    const policy = policies[block.block_id];
    if (!policy) continue;
    if (policy.category !== block.category) errors.push(`${block.block_id} category가 제품 정책과 다릅니다.`);
    const count = presetsByBlock.get(block.block_id)?.length ?? 0;
    if (count !== policy.expected_presets) errors.push(`${block.block_id} 프리셋 수 ${count}개가 계약 ${policy.expected_presets}개와 다릅니다.`);
    if (policy.status === 'product' && block.capabilities.includes('editor.compatibility-only')) errors.push(`${block.block_id} 제품 블록이 compatibility-only로 후퇴했습니다.`);
    if (policy.status === 'compatibility' && !block.capabilities.includes('editor.compatibility-only')) errors.push(`${block.block_id} 호환 블록 상태가 manifest와 다릅니다.`);
  }

  const presetIds = new Set();
  const labels = new Set();
  const propsByBlock = new Map();
  for (const preset of presets) {
    if (presetIds.has(preset.preset_id)) errors.push(`중복 preset_id: ${preset.preset_id}`);
    presetIds.add(preset.preset_id);
    const label = preset.label?.ko?.trim() ?? '';
    const description = preset.description?.ko?.trim() ?? '';
    if (label.length < contract.copy.minimum_label_length) errors.push(`${preset.preset_id} 표시 이름이 너무 짧습니다.`);
    if (description.length < contract.copy.minimum_description_length) errors.push(`${preset.preset_id} 용도 설명이 너무 짧습니다.`);
    if (labels.has(label)) errors.push(`프리셋 표시 이름이 중복됩니다: ${label}`);
    labels.add(label);
    const propsHash = sha256(JSON.stringify(stable(preset.props)));
    const priorProps = propsByBlock.get(`${preset.block_id}:${propsHash}`);
    if (priorProps) errors.push(`${preset.preset_id} 콘텐츠가 ${priorProps}와 완전히 중복됩니다.`);
    propsByBlock.set(`${preset.block_id}:${propsHash}`, preset.preset_id);
    for (const entry of flattenStrings(preset.props)) {
      for (const pattern of contract.copy.prohibited_patterns) {
        if (new RegExp(pattern, 'iu').test(entry.value)) errors.push(`${preset.preset_id}:${entry.path}에 placeholder 문구가 남았습니다: ${entry.value}`);
      }
    }
    validateImageObject(errors, root, preset.preset_id, preset.props, 'props', contract.media.prohibited_alt_patterns);
    validateDates(errors, preset.preset_id, preset.props);
  }

  const presentationKeys = new Set(contract.variation.presentation_keys);
  for (const [blockId, blockPresets] of presetsByBlock) {
    if (blockPresets.length < 2) continue;
    const signatures = new Set(blockPresets.map((preset) => JSON.stringify(stable(collectPresentationValues(preset.props, presentationKeys)))));
    const minimum = Math.min(blockPresets.length, contract.variation.minimum_distinct_signatures);
    if (signatures.size < minimum) errors.push(`${blockId} 프리셋의 실제 구조 차이가 부족합니다: ${signatures.size}/${minimum}`);
  }

  const items = generatedCatalogItems(root, manifest, index);
  if (items.length !== contract.inventory.catalog_item_count) errors.push(`검토 대상 생성물 수가 계약과 다릅니다: ${items.length}`);
  const actualIds = items.map((item) => item.catalogId).sort();
  const indexedIds = Object.keys(index.sources ?? {}).sort();
  if (index.count !== items.length || JSON.stringify(actualIds) !== JSON.stringify(indexedIds)) {
    errors.push('renderer source index가 현재 블록·프리셋 재고와 정확히 일치하지 않습니다.');
  }
  for (const item of items) {
    if (!existsSync(item.thumbnailPath)) errors.push(`${item.catalogId} 썸네일이 없습니다.`);
    if (!/^[a-f0-9]{64}$/.test(item.sourceHash ?? '')) errors.push(`${item.catalogId} renderer source hash가 없습니다.`);
    if (!/^[a-f0-9]{64}$/.test(item.thumbnailHash ?? '')) errors.push(`${item.catalogId} 썸네일 hash를 계산할 수 없습니다.`);
  }
  const presetItems = items.filter((item) => item.catalogId.startsWith('preset:'));
  if (new Set(presetItems.map((item) => item.thumbnailHash)).size !== presets.length) {
    errors.push('95개 프리셋 썸네일은 서로 다른 실제 결과여야 합니다.');
  }
  const uniqueThumbnails = new Set(items.map((item) => item.thumbnailHash)).size;
  if (uniqueThumbnails !== contract.inventory.unique_thumbnail_count) {
    errors.push(`고유 썸네일 수가 계약과 다릅니다: ${uniqueThumbnails}/${contract.inventory.unique_thumbnail_count}`);
  }
  for (const block of activeBlocks) {
    const firstPreset = presetsByBlock.get(block.block_id)?.[0];
    const blockItem = items.find((item) => item.catalogId === `block:${block.block_id}@${block.block_version}`);
    const presetItem = firstPreset ? items.find((item) => item.catalogId === `preset:${manifest.pack_id}:${firstPreset.preset_id}`) : null;
    if (!blockItem || !presetItem || blockItem.thumbnailHash !== presetItem.thumbnailHash) {
      errors.push(`${block.block_id} 기본 블록 썸네일이 canonical 첫 프리셋과 다릅니다.`);
    }
  }

  const requiredDynamicPreviews = contract.dynamic_preview.minimum_items_by_block;
  const expectedDynamicCatalogIds = new Set();
  for (const item of items) {
    const minimumItems = requiredDynamicPreviews[item.blockId];
    if (minimumItems === undefined) {
      if (item.dynamicSampleCount !== 0) errors.push(`${item.catalogId}에 선언되지 않은 동적 미리보기 샘플이 있습니다.`);
      continue;
    }
    expectedDynamicCatalogIds.add(item.catalogId);
    if (!Number.isInteger(item.dynamicSampleCount) || item.dynamicSampleCount < minimumItems) {
      errors.push(`${item.catalogId} 동적 미리보기 항목이 부족합니다: ${item.dynamicSampleCount}/${minimumItems}`);
    }
  }
  const dynamicBlockIds = Object.keys(requiredDynamicPreviews).sort();
  const knownDynamicBlockIds = blocks.filter((block) => block.block_id.startsWith('g7.')).map((block) => block.block_id).sort();
  if (JSON.stringify(dynamicBlockIds) !== JSON.stringify(knownDynamicBlockIds)) {
    errors.push('모든 G7 동적 블록은 결정적 라이브러리 미리보기 기준을 가져야 합니다.');
  }
  const indexedDynamicIds = Object.keys(index.dynamic_samples ?? {}).sort();
  if (JSON.stringify(indexedDynamicIds) !== JSON.stringify([...expectedDynamicCatalogIds].sort())) {
    errors.push('동적 미리보기 생성 인덱스가 현재 블록·프리셋 재고와 정확히 일치하지 않습니다.');
  }

  if (verifyRenderSource) {
    const currentState = freshSources === null
      ? freshRenderState(root)
      : { sources: freshSources, dynamicSamples: freshDynamicSamples ?? {} };
    const currentSources = currentState.sources;
    for (const item of items) {
      if (currentSources[item.catalogId] !== item.sourceHash) errors.push(`${item.catalogId} 썸네일이 현재 props/compiler/CSS보다 오래되었습니다.`);
      if (expectedDynamicCatalogIds.has(item.catalogId) && currentState.dynamicSamples[item.catalogId] !== item.dynamicSampleCount) {
        errors.push(`${item.catalogId} 동적 미리보기 샘플이 현재 fixture와 다릅니다.`);
      }
    }
    const unexpected = Object.keys(currentSources).filter((catalogId) => !actualIds.includes(catalogId));
    if (unexpected.length > 0) errors.push(`현재 renderer가 선언하지 않은 생성물을 반환했습니다: ${unexpected.join(', ')}`);
    const unexpectedDynamic = Object.keys(currentState.dynamicSamples).filter((catalogId) => !expectedDynamicCatalogIds.has(catalogId));
    if (unexpectedDynamic.length > 0) errors.push(`선언되지 않은 동적 미리보기 생성물이 있습니다: ${unexpectedDynamic.join(', ')}`);
  }

  const digest = productReviewDigest(contract.contract_version, items);
  // Development may verify changed render artifacts while the preserved v1
  // approval remains historical. Neither this nor candidate mode grants approval.
  const approvalChecked = !candidate && !technical;
  if (approvalChecked) {
    if (approval.catalog_digest !== digest) errors.push(`제품 검토 승인이 현재 생성물과 다릅니다. review_digest=${digest}`);
    if (approval.item_count !== items.length) errors.push('제품 검토 승인 item_count가 현재 생성물 수와 다릅니다.');
    if (approval.decision !== 'approved') errors.push('제품 검토가 approved 상태가 아닙니다.');
    if ((approval.findings ?? []).length > 0) errors.push('미해결 제품 검토 finding이 남아 있습니다.');
    for (const criterion of contract.review.required_criteria) {
      if (approval.criteria?.[criterion] !== 'pass') errors.push(`제품 검토 기준 ${criterion}이 pass가 아닙니다.`);
    }
    if (!contract.review.allowed_reviewer_kinds.includes(approval.reviewer?.kind)) errors.push('허용되지 않은 제품 검토자 종류입니다.');
  }
  if (release || technical) validateWiring(errors, root, packageJson);
  return { digest, errors, items, approvalChecked };
}

async function main() {
  const args = process.argv.slice(2);
  const rootFlag = args.indexOf('--root');
  const rootValue = rootFlag >= 0 ? args[rootFlag + 1] : process.cwd();
  if (!rootValue || rootValue.startsWith('--')) throw new Error('--root requires a path.');
  const flags = args.filter((_, index) => rootFlag < 0 || (index !== rootFlag && index !== rootFlag + 1));
  const allowed = ['--candidate', '--technical', '--release', '--verify-render-source'];
  if (flags.some(flag => !allowed.includes(flag)) || new Set(flags).size !== flags.length) {
    throw new Error('Unknown or duplicate block quality option.');
  }
  const root = resolve(rootValue);
  const candidate = flags.includes('--candidate');
  const technical = flags.includes('--technical');
  const release = flags.includes('--release');
  const verifyRenderSource = flags.includes('--verify-render-source');
  const manifest = json(resolve(root, MANIFEST_PATH));
  const index = json(resolve(root, GENERATED_INDEX_PATH));
  const quality = json(resolve(root, QUALITY_PATH));
  const schema = json(resolve(root, QUALITY_SCHEMA_PATH));
  const packageJson = json(resolve(root, 'package.json'));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validateSchema = ajv.compile(schema);
  if (!validateSchema(quality)) {
    for (const error of validateSchema.errors ?? []) console.error(`BLOCK_PRODUCT_QUALITY_SCHEMA\t${error.instancePath} ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const result = validateBlockProductQuality({ root, manifest, index, quality, packageJson, candidate, technical, release, verifyRenderSource });
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`BLOCK_PRODUCT_QUALITY\t${error}`);
    process.exitCode = 1;
    return;
  }
  const mode = technical ? 'TECHNICAL_OK' : candidate ? 'CANDIDATE_OK' : 'LEGACY_REVIEW_OK';
  console.log(`BLOCK_PRODUCT_QUALITY\t${mode} items=${result.items.length} review_digest=${result.digest} approval_checked=${result.approvalChecked} release_authorized=false`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
