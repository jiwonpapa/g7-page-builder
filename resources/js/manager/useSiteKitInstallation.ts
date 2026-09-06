import { useEffect, useRef, useState } from 'react';
import { PageBuilderApiError, type PageBuilderApiClient } from '../api/pageBuilderApi';
import type { SiteKitInstallInput, SiteKitPreview, SiteKitReceipt, SiteKitSummary } from '../api/siteKit';
import { readSiteKitInstallation, storeSiteKitInstallation } from './siteKitInstallationStorage';

type Api = Pick<PageBuilderApiClient, 'listSiteKits' | 'previewSiteKit' | 'installSiteKit'>;
export function useSiteKitInstallation(api: Api, locale: string) {
  const [initial] = useState(readSiteKitInstallation);
  const [catalog, setCatalog] = useState<SiteKitSummary[]>([]);
  const [selected, setSelected] = useState<SiteKitSummary | null>(null);
  const [title, setTitle] = useState(initial?.pending?.title ?? '');
  const [paths, setPaths] = useState<Record<string, string>>(initial?.pending?.paths ?? {});
  const [preview, setPreview] = useState<SiteKitPreview | null>(null);
  const [pending, setPending] = useState<SiteKitInstallInput | null>(initial?.pending ?? null);
  const [receipt, setReceipt] = useState<SiteKitReceipt | null>(initial?.receipt ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const owner = useRef({ generation: 0, mounted: false, pending: false });
  useEffect(() => {
    const generation = ++owner.current.generation; owner.current.mounted = true;
    void api.listSiteKits().then(result => {
      if (owner.current.mounted && owner.current.generation === generation) setCatalog(result.items.filter(item => item.locale === locale));
    }).catch(error => {
      if (owner.current.mounted && owner.current.generation === generation) setMessage(error instanceof Error ? error.message : '사이트 킷을 불러오지 못했습니다.');
    });
    return () => { owner.current.mounted = false; };
  }, [api, locale, reload]);
  const choose = (kit: SiteKitSummary): void => {
    if (owner.current.pending || pending) return;
    setSelected(kit); setTitle(kit.title); setPaths(Object.fromEntries(kit.pages.map(page => [page.key, page.path])));
    setPreview(null); setMessage(null);
  };
  const editPath = (key: string, value: string): void => {
    if (owner.current.pending || pending) return;
    setPaths(current => ({ ...current, [key]: value })); setPreview(null); setMessage(null);
  };
  const check = async (): Promise<void> => {
    if (!selected || owner.current.pending || pending) return;
    owner.current.pending = true; setBusy(true); setMessage(null);
    const generation = owner.current.generation;
    try {
      const result = await api.previewSiteKit(selected.id, paths);
      if (owner.current.mounted && owner.current.generation === generation) setPreview(result);
    } catch (error) {
      if (owner.current.mounted && owner.current.generation === generation) setMessage(error instanceof Error ? error.message : '구성을 확인하지 못했습니다.');
    } finally { if (owner.current.mounted && owner.current.generation === generation) { owner.current.pending = false; setBusy(false); } }
  };
  const install = async (): Promise<void> => {
    if (owner.current.pending || (!pending && (!selected || !preview?.can_install || !title.trim()))) return;
    const input = pending ?? (selected && preview ? { kit_id: selected.id, kit_version: preview.kit_version,
      title: title.trim(), paths, request_id: crypto.randomUUID() } : null);
    if (!input) return;
    owner.current.pending = true; setBusy(true); setMessage(null);
    const generation = owner.current.generation;
    try {
      storeSiteKitInstallation({ pending: input, receipt: null });
      setPending(input);
      const result = await api.installSiteKit(input);
      storeSiteKitInstallation({ pending: null, receipt: result });
      if (owner.current.mounted && owner.current.generation === generation) { setReceipt(result); setPending(null); }
    } catch (error) {
      if (owner.current.mounted && owner.current.generation === generation) {
        setMessage(error instanceof Error ? error.message : '설치 결과를 확인하지 못했습니다.');
        // A definitive rejection created no new draft. Network/503 uncertainty retains the same request.
        if (error instanceof PageBuilderApiError && [400, 409, 422].includes(error.status)) {
          storeSiteKitInstallation(null); setPending(null); setPreview(null);
        }
      }
    } finally { if (owner.current.mounted && owner.current.generation === generation) { owner.current.pending = false; setBusy(false); } }
  };
  const reset = (): void => {
    if (busy || pending) return;
    storeSiteKitInstallation(null); setReceipt(null); setSelected(null); setPreview(null); setMessage(null);
  };
  return { catalog, selected, title, setTitle, paths, preview, pending, receipt, busy, message,
    choose, editPath, check, install, reset, reload: () => setReload(value => value + 1) };
}
