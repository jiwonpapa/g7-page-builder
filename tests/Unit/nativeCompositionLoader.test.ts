import { afterEach, expect, it, vi } from 'vitest';
import { loadNativeCompositions } from '../../resources/js/adapters/gnuboard7/loadCompositions';
afterEach(() => { document.head.innerHTML = ''; delete window.JiwonpapaNativeCompositions; vi.restoreAllMocks(); });
it('loads once on demand, preserves nonce and retries after a failed script', async () => {
  const owner = document.createElement('script'); owner.dataset.g7pbNativeAsset = 'true'; owner.nonce = 'fixture'; document.head.append(owner);
  const failed = loadNativeCompositions(); expect(loadNativeCompositions()).toBe(failed);
  const script = document.querySelector<HTMLScriptElement>('[data-g7pb-composition-asset]')!;
  expect(script.nonce).toBe('fixture'); expect(script.src).toContain('/dist/js/page-builder-native-compositions.iife.js');
  script.dispatchEvent(new Event('error')); await expect(failed).rejects.toThrow('composition-asset-failed');
  expect(script.isConnected).toBe(false);
  const retry = loadNativeCompositions(); const Panel = () => null; window.JiwonpapaNativeCompositions = { NativeCompositionPanel: Panel };
  document.querySelector('[data-g7pb-composition-asset]')!.dispatchEvent(new Event('load'));
  expect(await retry).toBe(Panel); expect(await loadNativeCompositions()).toBe(Panel);
});
