import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { expect, type APIRequestContext, type Page, type Response } from '@playwright/test';

export type SitePartKind = 'header' | 'footer';
export interface SitePartResource {
  set_id: string;
  title: string;
  document: {
    schema_version: 'g7-page-builder/site-part/v1'; site_part_id: string; kind: SitePartKind; locale: string;
    tokens: Record<string, string | number | boolean | null>;
    blocks: Array<{ instance_id: string; type: string; block_version: number; props: Record<string, unknown>; slots: Record<string, unknown> }>;
  };
  lock_version: number; revision: number; active_revision: number | null;
  status: 'draft' | 'published_with_changes' | 'published';
}
export interface SitePartSetResource {
  id: string; title: string; locale: string; is_active: boolean; is_ready: boolean;
}
const API = '/api/modules/jiwonpapa-page_builder/admin';

function stateCommand(action: string, input: Record<string, string>): void {
  if (!process.env.G7PB_SITE_PART_FIXTURE_SCOPE || !process.env.G7PB_SITE_PART_FIXTURE_TOKEN) {
    throw new Error('Owned Site Part tests require the scoped Local runner; no shared-content fallback.');
  }
  const helper = resolve('tests/E2E/support/sitePartState.php');
  // The helper independently checks Local runtime, capability, path and UUIDs.
  execFileSync('php', [helper], {
    cwd: process.env.G7PB_G7_ROOT ?? '/var/www/g7',
    env: { ...process.env, G7PB_SITE_PART_FIXTURE_ACTION: action, G7PB_SITE_PART_FIXTURE_INPUT: JSON.stringify(input) },
    stdio: 'pipe', timeout: 30_000,
  });
}

export class SitePartSetFixture {
  private readonly session = randomUUID();
  private readonly owned = new Set<string>();
  private next = 0;
  private started = false;
  private primary?: SitePartSetResource;

  constructor(private readonly api: APIRequestContext, readonly locale: string) {}

  async start(page?: Page): Promise<void> {
    stateCommand('begin', { session: this.session, locale: this.locale });
    this.started = true;
    this.primary = await this.create();
    await this.activate(this.primary.id);
    if (page) await this.bindOwnedRequests(page);
  }

  get primaryId(): string {
    if (!this.primary) throw new Error('Owned primary set is not ready.');
    return this.primary.id;
  }

  private async bindOwnedRequests(page: Page): Promise<void> {
    // GET opens the owned fixture through the API's existing selector. Writes
    // must carry product-selected identity themselves; never fix their payload.
    await page.route(/\/api\/modules\/jiwonpapa-page_builder\/admin\/site-parts\/(header|footer)(?:\/(draft|publish|bootstrap))?(?:\?|$)/, async (route) => {
      const request = route.request();
      if (request.url().includes('/bootstrap')) {
        await route.abort();
        throw new Error('Owned Site Part must never bootstrap shared content.');
      }
      if (request.method() === 'GET') {
        const url = new URL(request.url());
        const id = url.searchParams.get('set_id') ?? this.primaryId;
        this.assertOwned(id);
        url.searchParams.set('set_id', id);
        await route.continue({ url: url.toString() });
      } else {
        const data = request.postDataJSON() as { set_id?: string };
        if (!data.set_id || !this.owned.has(data.set_id)) {
          await route.abort();
          throw new Error('Product attempted an unowned or implicit Site Part write.');
        }
        await route.continue();
      }
    });
  }

  private assertOwned(id: string): void {
    if (!this.owned.has(id)) throw new Error('Site Part fixture refuses an unowned set UUID.');
  }

  async read(kind: SitePartKind, id = this.primary?.id): Promise<SitePartResource> {
    if (!id) throw new Error('Owned primary set is not ready.');
    this.assertOwned(id);
    const query = new URLSearchParams({ locale: this.locale, set_id: id });
    const response = await this.api.get(`${API}/site-parts/${kind}?${query}`);
    expect(response.ok(), `Owned ${kind} read: ${response.status()}`).toBe(true);
    const { data } = await response.json() as { data: SitePartResource };
    expect(data.set_id).toBe(id);
    return data;
  }

  async create(): Promise<SitePartSetResource> {
    const title = `E2E-owned-${this.session}-${this.next++}`;
    stateCommand('reserve', { session: this.session, title });
    const created = await this.api.post(`${API}/site-part-sets`, { data: { locale: this.locale, title } });
    expect(created.ok(), `Owned set creation: ${created.status()}`).toBe(true);
    const { data: set } = await created.json() as { data: SitePartSetResource };
    stateCommand('register', { session: this.session, id: set.id });
    this.owned.add(set.id);
    const header = await this.read('header', set.id);
    const footer = await this.read('footer', set.id);
    const block = (type: string, props: Record<string, unknown>, slots: Record<string, unknown> = {}) => ({
      instance_id: randomUUID(), type, block_version: 1, props, slots,
    });
    const documents = {
      header: {
        schema_version: 'g7-page-builder/site-part/v1', site_part_id: header.document.site_part_id, kind: 'header', locale: this.locale, tokens: {},
        blocks: [block('site.header.navigation-01', {
          brand_name: 'Owned fixture', use_site_settings: false, logo_url: '', home_url: '/', variant: 'solid', sticky: false,
          navigation: [{ label: 'Fixture link', url: '/boards' }], cta: null, mobile_menu: true, mobile_menu_style: 'drawer-right',
        }, { systemControls: [block('site.header.system-controls-01', {
          search: true, account: true, cart: true, notifications: true, theme: true, locale: true, currency: true,
        })] })],
      },
      footer: {
        schema_version: 'g7-page-builder/site-part/v1', site_part_id: footer.document.site_part_id, kind: 'footer', locale: this.locale, tokens: {},
        blocks: [block('site.footer.simple-01', {
          brand_name: 'Owned fixture', use_site_settings: false, home_url: '/', navigation: [{ label: 'Fixture link', url: '/boards' }], footer_text: 'Fixture',
        })],
      },
    };
    const saved = await this.api.put(`${API}/site-part-sets/${set.id}/draft`, { data: {
      locale: this.locale,
      header: { title: `${title} Header`, document: documents.header, expected_lock_version: header.lock_version },
      footer: { title: `${title} Footer`, document: documents.footer, expected_lock_version: footer.lock_version },
    } });
    expect(saved.ok(), `Synthetic pair save: ${saved.status()}`).toBe(true);
    const { data } = await saved.json() as { data: { header: SitePartResource; footer: SitePartResource } };
    const published = await this.api.post(`${API}/site-part-sets/${set.id}/publish`, { data: {
      locale: this.locale, header_expected_lock_version: data.header.lock_version, footer_expected_lock_version: data.footer.lock_version,
    } });
    expect(published.ok(), `Synthetic pair publication: ${published.status()}`).toBe(true);
    return (await published.json() as { data: { set: SitePartSetResource } }).data.set;
  }

  prepareActivation(id: string): void {
    this.assertOwned(id);
    stateCommand('prepare', { session: this.session, id });
  }

  checkpointActivation(): void { stateCommand('checkpoint', { session: this.session }); }

  async activate(id: string): Promise<void> {
    this.prepareActivation(id);
    const activated = await this.api.post(`${API}/site-part-sets/${id}/activate`, { data: { locale: this.locale } });
    expect(activated.ok(), `Owned activation: ${activated.status()}`).toBe(true);
    this.checkpointActivation();
  }

  restore(): void {
    if (this.started) stateCommand('restore', { session: this.session });
  }
}

export async function assertPublicShellLocale(response: Pick<Response, 'url' | 'ok' | 'json'>, locale: string): Promise<void> {
  // The public G7 locale travels through its standard request headers. A stale
  // expression that silently adds locale=ko must fail, including in English.
  expect(new URL(response.url()).searchParams.has('locale')).toBe(false);
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { data?: { shell?: { enabled?: boolean; locale?: string } } };
  expect(payload.data?.shell?.enabled).toBe(true);
  expect(payload.data?.shell?.locale).toBe(locale);
}

export async function gotoOwnedSiteShell(page: Page, path: string, locale: string): Promise<Response | null> {
  const [shell, navigation] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).pathname === '/api/modules/jiwonpapa-page_builder/public/site-shell'
      && response.request().method() === 'GET'),
    page.goto(path),
  ]);
  await assertPublicShellLocale(shell, locale);
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  return navigation;
}

export async function fixtureLocale(page: Page): Promise<string> {
  expect((await page.goto('/'))?.ok()).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  return 'ko';
}
