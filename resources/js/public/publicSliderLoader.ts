export interface PublicSliderApi {
  bootPageSliders(root?: Document, reducedMotion?: boolean): void;
  disposePageSliders(root?: Document): void;
}

declare global {
  interface Window {
    JiwonpapaPageSliders?: PublicSliderApi;
  }
}

interface SliderLoaderState {
  view: Window;
  generation: number;
  desired: boolean;
  api: PublicSliderApi | null;
  load: Promise<PublicSliderApi> | null;
  script: HTMLScriptElement | null;
}

const EFFECTS_NAME = 'page-effects.iife.js';
const SLIDERS_NAME = 'page-sliders.iife.js';
const states = new WeakMap<Document, SliderLoaderState>();

function validApi(value: PublicSliderApi | undefined): value is PublicSliderApi {
  return typeof value?.bootPageSliders === 'function' && typeof value.disposePageSliders === 'function';
}

function stateFor(root: Document): SliderLoaderState {
  const view = root.defaultView;
  if (!view) throw new Error('Slider runtime requires a document window.');
  const existing = states.get(root);
  if (existing?.view === view) return existing;
  existing?.api?.disposePageSliders(root);
  const state: SliderLoaderState = {
    view,
    generation: 0,
    desired: false,
    api: null,
    load: null,
    script: null,
  };
  states.set(root, state);
  return state;
}

function assetSource(root: Document, state: SliderLoaderState): { url: string; nonce: string } {
  const candidates = Array.from(root.scripts).flatMap((script) => {
    try {
      const url = new URL(script.src, root.baseURI);
      return url.pathname.endsWith(`/${EFFECTS_NAME}`) ? [{ script, url }] : [];
    } catch {
      return [];
    }
  });
  const source = candidates.find(({ url }) => url.origin === state.view.location.origin);
  if (!source) {
    if (candidates.length > 0) throw new Error('Slider runtime refuses a cross-origin page effects asset.');
    throw new Error('Slider runtime cannot locate the page effects asset.');
  }
  source.url.pathname = `${source.url.pathname.slice(0, -EFFECTS_NAME.length)}${SLIDERS_NAME}`;
  return { url: source.url.href, nonce: source.script.nonce ?? '' };
}

function loadSliderApi(root: Document, state: SliderLoaderState): Promise<PublicSliderApi> {
  if (validApi(state.view.JiwonpapaPageSliders)) {
    state.api = state.view.JiwonpapaPageSliders;
    root.documentElement.dataset.g7pbSliderAssetReady = 'true';
    delete root.documentElement.dataset.g7pbSliderLoadError;
    return Promise.resolve(state.api);
  }
  if (state.load) return state.load;

  const source = assetSource(root, state);
  const script = root.createElement('script');
  script.src = source.url;
  script.async = true;
  script.dataset.g7pbSliderAsset = source.url;
  if (source.nonce) script.nonce = source.nonce;
  state.script = script;

  const load = new Promise<PublicSliderApi>((resolve, reject) => {
    const fail = (message: string): void => {
      if (state.script === script) state.script = null;
      if (state.load === load) state.load = null;
      script.remove();
      delete root.documentElement.dataset.g7pbSliderAssetReady;
      root.documentElement.dataset.g7pbSliderLoadError = 'true';
      reject(new Error(message));
    };
    script.addEventListener('load', () => {
      const api = state.view.JiwonpapaPageSliders;
      if (!validApi(api)) {
        fail('Slider asset did not register JiwonpapaPageSliders.');
        return;
      }
      state.api = api;
      state.script = script;
      root.documentElement.dataset.g7pbSliderAssetReady = 'true';
      delete root.documentElement.dataset.g7pbSliderLoadError;
      resolve(api);
    }, { once: true });
    script.addEventListener('error', () => fail('Slider asset failed to load.'), { once: true });
  });
  state.load = load;
  root.head.append(script);
  return load;
}

export function bootPageSliders(root: Document = document, reducedMotion = false): void {
  const state = stateFor(root);
  const generation = ++state.generation;
  state.desired = root.querySelector('[data-g7pb-slider]') !== null;
  if (!state.desired) {
    state.api?.disposePageSliders(root);
    return;
  }
  let load: Promise<PublicSliderApi>;
  try {
    load = loadSliderApi(root, state);
  } catch {
    delete root.documentElement.dataset.g7pbSliderAssetReady;
    root.documentElement.dataset.g7pbSliderLoadError = 'true';
    return;
  }
  void load.then((api) => {
    if (states.get(root) !== state || state.generation !== generation) {
      if (!state.desired) api.disposePageSliders(root);
      return;
    }
    if (!state.desired || root.querySelector('[data-g7pb-slider]') === null) {
      state.desired = false;
      api.disposePageSliders(root);
      return;
    }
    api.bootPageSliders(root, reducedMotion);
  }).catch(() => {});
}

export function disposePageSliders(root: Document = document): void {
  const state = states.get(root);
  if (!state) return;
  state.generation += 1;
  state.desired = false;
  state.api?.disposePageSliders(root);
}
