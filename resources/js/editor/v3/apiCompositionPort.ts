import type { ElementCompositionApi } from '../../api/elementCompositionApi';
import type { CompositionLibraryPort } from '../../editor-application/v3/compositionLibrary';

export function createApiCompositionPort(api: ElementCompositionApi): CompositionLibraryPort {
  return { list: () => api.list(), create: (title, source) => api.create(title, source), remove: id => api.remove(id) };
}
