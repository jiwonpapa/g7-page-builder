import type { ComponentType } from 'react';
import type { NativeCompositionPanelProps } from '../../native-editor/ports/compositions';
declare global { interface Window { JiwonpapaNativeCompositions?: { NativeCompositionPanel?: ComponentType<NativeCompositionPanelProps> } } }
let pending: Promise<ComponentType<NativeCompositionPanelProps>> | null = null;
/** Load only when the user opens the library; failures leave the editor usable and retryable. */
export function loadNativeCompositions(): Promise<ComponentType<NativeCompositionPanelProps>> {
  const ready = window.JiwonpapaNativeCompositions?.NativeCompositionPanel;
  if (typeof ready === 'function') return Promise.resolve(ready);
  if (pending) return pending;
  const script = document.createElement('script');
  script.src = '/api/modules/assets/jiwonpapa-page_builder/dist/js/page-builder-native-compositions.iife.js';
  script.dataset.g7pbCompositionAsset = 'true';
  const owner = document.querySelector<HTMLScriptElement>('script[data-g7pb-native-asset]');
  if (owner?.nonce) script.nonce = owner.nonce;
  pending = new Promise<ComponentType<NativeCompositionPanelProps>>((resolve, reject) => {
    script.onload = () => {
      const component = window.JiwonpapaNativeCompositions?.NativeCompositionPanel;
      if (typeof component === 'function') resolve(component);
      else reject(new Error('composition-export-missing'));
    };
    script.onerror = () => reject(new Error('composition-asset-failed'));
    document.head.append(script);
  }).catch(error => { pending = null; script.remove(); throw error; });
  return pending;
}

