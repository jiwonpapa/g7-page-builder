import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_AUTH_TOKEN_KEY, PageBuilderApiClient } from '../api/pageBuilderApi';
import type { SitePartResource } from '../api/resources';
import type { PageBuilderDocument } from '../documents/types';
import { BLOCK_GALLERY_ITEMS, apiCatalogItemToGalleryItem, type BlockCatalogContextValue } from './BlockCatalogContext';
import type { BlockGalleryItem } from './blockGalleryModel';

export function usePageBuilderResources(locale: string, shellMode: PageBuilderDocument['shell_mode'], canEdit: boolean) {
  const api = useMemo(() => new PageBuilderApiClient(), []);
  const scope = useMemo(() => ({ active: true }), [locale]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  useEffect(() => { scope.active = true; return () => { scope.active = false; }; }, [scope]);
  const [catalogItems, setCatalogItems] = useState<ReadonlyArray<BlockGalleryItem>>(BLOCK_GALLERY_ITEMS);
  const [siteParts, setSiteParts] = useState<{ header: SitePartResource | null; footer: SitePartResource | null }>({ header: null, footer: null });
  const [sitePartMode, setSitePartMode] = useState<'header' | 'footer' | null>(null);

  useEffect(() => {
    let active = true;
    try {
      if (!window.localStorage.getItem(ADMIN_AUTH_TOKEN_KEY)) return undefined;
    } catch {
      return undefined;
    }
    void api.listBlockCatalog({ locale }).then((resource) => {
      if (!active || !scope.active || currentScope.current !== scope) return;
      const items = resource.items.map((item) => apiCatalogItemToGalleryItem(item, locale))
        .filter((item): item is BlockGalleryItem => item !== null);
      if (items.length > 0) setCatalogItems(items);
    }).catch(() => {
      // The embedded builtin catalog remains available when the admin API fails.
    });
    return () => { active = false; };
  }, [api, locale, scope]);

  useEffect(() => {
    if (shellMode !== 'builder' && shellMode !== 'global') {
      setSiteParts({ header: null, footer: null });
      return undefined;
    }
    let active = true;
    void Promise.allSettled([api.getSitePart('header', locale), api.getSitePart('footer', locale)]).then(([header, footer]) => {
      if (!active || !scope.active || currentScope.current !== scope) return;
      setSiteParts({ header: header.status === 'fulfilled' ? header.value : null,
        footer: footer.status === 'fulfilled' ? footer.value : null });
    });
    return () => { active = false; };
  }, [api, locale, scope, shellMode]);

  const toggleFavorite = useCallback(async (catalogId: string, favorite: boolean): Promise<void> => {
    if (!scope.active || currentScope.current !== scope) return;
    await api.setBlockFavorite(catalogId, favorite);
    if (!scope.active || currentScope.current !== scope) return;
    setCatalogItems((current) => current.map((item) => item.catalogId === catalogId ? { ...item, favorite } : item));
  }, [api, scope]);
  const blockCatalogContext = useMemo<BlockCatalogContextValue>(() => ({ items: catalogItems, toggleFavorite }), [catalogItems, toggleFavorite]);
  const editSitePart = useCallback((kind: 'header' | 'footer'): void => {
    if (canEdit && scope.active && currentScope.current === scope) setSitePartMode(kind);
  }, [canEdit, scope]);
  const closeSitePartEditor = useCallback((): void => setSitePartMode(null), []);
  const refreshSitePart = useCallback((resource: SitePartResource): void => {
    if (!scope.active || currentScope.current !== scope || resource.document.locale !== locale) return;
    setSiteParts((current) => ({ ...current, [resource.document.kind]: resource }));
  }, [locale, scope]);
  return { blockCatalogContext, siteParts, sitePartMode, editSitePart, closeSitePartEditor, refreshSitePart };
}
