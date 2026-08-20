import type { BlockPackResource } from './types';
import { hasExternalEditorRegistration } from './runtimeRegistry';

const assetLoads = new Map<string, Promise<void>>();

function loadStyle(url: string): Promise<void> {
  const existing = assetLoads.get(url);
  if (existing) return existing;

  const load = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.g7pbBlockPackAsset = url;
    link.addEventListener('load', () => resolve(), { once: true });
    link.addEventListener('error', () => reject(new Error(`Block Pack style failed to load: ${url}`)), { once: true });
    document.head.append(link);
  });
  assetLoads.set(url, load);

  return load;
}

function loadScript(url: string): Promise<void> {
  const existing = assetLoads.get(url);
  if (existing) return existing;

  const load = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = false;
    script.dataset.g7pbBlockPackAsset = url;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error(`Block Pack editor failed to load: ${url}`)), { once: true });
    document.head.append(script);
  });
  assetLoads.set(url, load);

  return load;
}

export async function loadBlockPackEditorAssets(packs: BlockPackResource[]): Promise<void> {
  const codePacks = packs
    .filter((pack) => pack.kind === 'code' && pack.source !== 'builtin' && pack.runtime_active)
    .sort((left, right) => `${left.pack_id}@${left.pack_version}`.localeCompare(`${right.pack_id}@${right.pack_version}`));

  for (const pack of codePacks) {
    if (!pack.editor_asset_url) {
      throw new Error(`Active Code Block Pack has no editor asset: ${pack.pack_id}@${pack.pack_version}`);
    }
    await Promise.all(pack.style_asset_urls.map(loadStyle));
    await loadScript(pack.editor_asset_url);
    if (!hasExternalEditorRegistration(pack.pack_id, pack.pack_version)) {
      throw new Error(`Code Block Pack editor did not register its manifest identity: ${pack.pack_id}@${pack.pack_version}`);
    }
  }
}
