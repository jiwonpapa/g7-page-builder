import { parseSiteKitInstallInput, parseSiteKitReceipt, type SiteKitInstallInput, type SiteKitReceipt } from '../api/siteKit';
const KEY = 'g7pb-site-kit-installation-v1';
export type StoredSiteKitInstallation = { pending: SiteKitInstallInput; receipt: null } | { pending: null; receipt: SiteKitReceipt };
export function readSiteKitInstallation(): StoredSiteKitInstallation | null {
  try {
    const text = window.sessionStorage.getItem(KEY); if (!text) return null;
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if ('pending' in value && value.pending) return { pending: parseSiteKitInstallInput(value.pending), receipt: null };
    if ('receipt' in value) return { pending: null, receipt: parseSiteKitReceipt(value.receipt) };
  } catch { /* Malformed local state cannot authorize an installation. */ }
  return null;
}
export function storeSiteKitInstallation(value: StoredSiteKitInstallation | null): void {
  if (value) window.sessionStorage.setItem(KEY, JSON.stringify(value));
  else window.sessionStorage.removeItem(KEY);
}
