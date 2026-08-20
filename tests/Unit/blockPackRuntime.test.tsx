import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import type { PageBuilderDocument } from '../../resources/js/documents/types';

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;

const {
  externalEditorComponents,
  hasExternalEditorRegistration,
} = await import('../../resources/js/blocks/runtimeRegistry');
const {
  canonicalToPuck,
  puckToCanonical,
} = await import('../../resources/js/editor/PuckEditorAdapter');
const { loadBlockPackEditorAssets } = await import('../../resources/js/blocks/runtimeLoader');

afterEach(() => {
  document.head.querySelectorAll('[data-g7pb-block-pack-asset]').forEach((asset) => asset.remove());
});

describe('Code Block Pack editor runtime', () => {
  it('registers a signed runtime component and preserves canonical props and block version', () => {
    window.G7PageBuilderBlockPacks?.register({
      pack_id: 'vendor/runtime-blocks',
      pack_version: '1.0.0',
      blocks: [{
        block_id: 'vendor.notice-01',
        block_version: 2,
        editor_component: 'VendorNotice',
      }],
      components: {
        VendorNotice: {
          label: '알림',
          defaultProps: { title: '알림 제목' },
          fields: { title: { type: 'text', label: '제목' } },
          render: ({ title }) => <aside>{String(title)}</aside>,
        },
      },
    });
    const document: PageBuilderDocument = {
      schema_version: 'g7-page-builder/v1',
      document_id: '00000000-0000-4000-8000-000000000001',
      slug: 'runtime-block',
      mode: 'canvas',
      locale: 'ko',
      blocks: [{
        instance_id: '00000000-0000-4000-8000-000000000002',
        type: 'vendor.notice-01',
        block_version: 2,
        props: { title: '서명 블록' },
        slots: {},
      }],
    };

    const session = canonicalToPuck(document);
    const roundTrip = puckToCanonical(session.data, session.context);

    expect(hasExternalEditorRegistration('vendor/runtime-blocks', '1.0.0')).toBe(true);
    expect(externalEditorComponents()).toHaveProperty('VendorNotice');
    expect(session.data.content[0].type).toBe('VendorNotice');
    expect(roundTrip.blocks[0]).toMatchObject({
      type: 'vendor.notice-01',
      block_version: 2,
      props: { title: '서명 블록' },
    });
  });

  it('loads active self-hosted Code Pack styles before its editor and verifies registration', async () => {
    window.G7PageBuilderBlockPacks?.register({
      pack_id: 'vendor/loaded-runtime',
      pack_version: '1.4.0',
      blocks: [{
        block_id: 'vendor.loaded-notice-01',
        block_version: 1,
        editor_component: 'VendorLoadedNotice',
      }],
      components: {
        VendorLoadedNotice: {
          label: '로드 알림',
          defaultProps: { title: '알림' },
          fields: { title: { type: 'text', label: '제목' } },
          render: ({ title }) => <aside>{String(title)}</aside>,
        },
      },
    });

    const loading = loadBlockPackEditorAssets([
      {
        pack_id: 'builtin/core', pack_version: '0.6.0', kind: 'code',
        publisher: { id: 'jiwonpapa', name: '지원파파' }, state: 'enabled', source: 'builtin',
        source_uri: null, archive_sha256: null, blocks: 12, presets: 0, runtime_active: true,
        editor_asset_url: '/ignored-builtin.js', style_asset_urls: [], usage: null,
        installed_at: null, updated_at: null,
      },
      {
        pack_id: 'vendor/disabled-runtime', pack_version: '1.0.0', kind: 'code',
        publisher: { id: 'vendor', name: 'Vendor' }, state: 'disabled', source: 'local',
        source_uri: null, archive_sha256: 'a'.repeat(64), blocks: 1, presets: 0, runtime_active: false,
        editor_asset_url: '/ignored-disabled.js', style_asset_urls: [], usage: null,
        installed_at: null, updated_at: null,
      },
      {
        pack_id: 'vendor/loaded-runtime', pack_version: '1.4.0', kind: 'code',
        publisher: { id: 'vendor', name: 'Vendor' }, state: 'enabled', source: 'local',
        source_uri: null, archive_sha256: 'b'.repeat(64), blocks: 1, presets: 0, runtime_active: true,
        editor_asset_url: '/block-packs/loaded/editor.js',
        style_asset_urls: ['/block-packs/loaded/style.css'], usage: null,
        installed_at: null, updated_at: null,
      },
    ]);

    await Promise.resolve();
    const link = document.head.querySelector<HTMLLinkElement>('link[data-g7pb-block-pack-asset]');
    expect(link?.getAttribute('href')).toBe('/block-packs/loaded/style.css');
    expect(document.head.querySelector('script[data-g7pb-block-pack-asset]')).toBeNull();
    link?.dispatchEvent(new Event('load'));
    await Promise.resolve();
    await Promise.resolve();

    const script = document.head.querySelector<HTMLScriptElement>('script[data-g7pb-block-pack-asset]');
    expect(script?.getAttribute('src')).toBe('/block-packs/loaded/editor.js');
    script?.dispatchEvent(new Event('load'));
    await expect(loading).resolves.toBeUndefined();
  });

  it('rejects incomplete or unregistered Code Pack editor assets', async () => {
    await expect(loadBlockPackEditorAssets([{
      pack_id: 'vendor/missing-editor', pack_version: '1.0.0', kind: 'code',
      publisher: { id: 'vendor', name: 'Vendor' }, state: 'enabled', source: 'local',
      source_uri: null, archive_sha256: 'c'.repeat(64), blocks: 1, presets: 0, runtime_active: true,
      editor_asset_url: null, style_asset_urls: [], usage: null,
      installed_at: null, updated_at: null,
    }])).rejects.toThrow('has no editor asset');

    const loading = loadBlockPackEditorAssets([{
      pack_id: 'vendor/unregistered-runtime', pack_version: '2.0.0', kind: 'code',
      publisher: { id: 'vendor', name: 'Vendor' }, state: 'enabled', source: 'github',
      source_uri: 'https://github.com/vendor/unregistered-runtime', archive_sha256: 'd'.repeat(64),
      blocks: 1, presets: 0, runtime_active: true,
      editor_asset_url: '/block-packs/unregistered/editor.js', style_asset_urls: [], usage: null,
      installed_at: null, updated_at: null,
    }]);
    await Promise.resolve();
    document.head.querySelector<HTMLScriptElement>('script[src="/block-packs/unregistered/editor.js"]')
      ?.dispatchEvent(new Event('load'));
    await expect(loading).rejects.toThrow('did not register its manifest identity');
  });

  it('rejects builtin overrides, undeclared components, and duplicate identities', () => {
    const component = {
      label: '외부 블록', defaultProps: {}, fields: {}, render: () => <aside>외부</aside>,
    };
    expect(() => window.G7PageBuilderBlockPacks?.register({
      pack_id: 'vendor/builtin-override', pack_version: '1.0.0',
      blocks: [{ block_id: 'vendor.override-01', block_version: 1, editor_component: 'Hero' }],
      components: { Hero: component },
    })).toThrow('block registration is invalid');

    expect(() => window.G7PageBuilderBlockPacks?.register({
      pack_id: 'vendor/extra-component', pack_version: '1.0.0',
      blocks: [{ block_id: 'vendor.exact-01', block_version: 1, editor_component: 'VendorExact' }],
      components: { VendorExact: component, VendorHidden: component },
    })).toThrow('must exactly match');

    expect(() => window.G7PageBuilderBlockPacks?.register({
      pack_id: 'vendor/runtime-blocks', pack_version: '1.0.0',
      blocks: [{ block_id: 'vendor.other-01', block_version: 1, editor_component: 'VendorOther' }],
      components: { VendorOther: component },
    })).toThrow('already registered');
  });
});
