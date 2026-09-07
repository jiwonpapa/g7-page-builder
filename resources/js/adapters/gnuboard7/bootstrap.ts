import type {} from './editor';

/** Loaded with module assets; the native UI is requested only when the host editor is ready. */
export function prepareNativeEditor(): void {
  const nonce = document.currentScript instanceof HTMLScriptElement ? document.currentScript.nonce : '';
  window.G7Core?.layoutEditor?.onReady?.(() => {
    if (typeof window.G7Core?.layoutEditor?.registerPanel !== 'function'
      || document.querySelector('[data-g7pb-native-asset]')) return;
    const base = '/api/modules/assets/jiwonpapa-page_builder/dist/';
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = base + 'css/page-builder-native.css';
    const script = document.createElement('script');
    script.src = base + 'js/page-builder-native.iife.js';
    script.dataset.g7pbNativeAsset = 'true';
    script.async = true;
    if (nonce) script.nonce = nonce;
    script.onerror = () => { document.documentElement.dataset.g7pbNativeEditor = 'failed'; };
    document.head.append(css, script);
  });
}
