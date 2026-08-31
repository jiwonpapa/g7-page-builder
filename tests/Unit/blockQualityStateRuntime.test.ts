import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { bootDynamicData } from '../../resources/js/public/pageEffects';
import { createQualityFixtureFetch, parseQualityStateFixtures } from '../../scripts/lib/blockQualityStates';

const fixtures = parseQualityStateFixtures(JSON.parse(readFileSync('tests/Fixtures/block-quality-states.json', 'utf8')));
const sources = ['posts', 'products', 'post-archive', 'product-showcase', 'post-detail', 'product-detail'];

describe('isolated quality state injection into the published data renderer', () => {
  it.each(sources)('renders empty/error/missing responses for %s without touching real fetch, auth or storage', async source => {
    const originalFetch = globalThis.fetch;
    const stored = window.localStorage.getItem('auth_token');
    const endpoint = source.includes('product') ? '/api/modules/sirsoft-ecommerce/products/fixture' : '/api/modules/sirsoft-board/boards/posts/recent?limit=3';
    for (const id of ['data-empty', 'data-error', 'capability-missing']) {
      const root = document.implementation.createHTMLDocument('quality fixture');
      const target = source.endsWith('-detail') ? 'data-g7pb-data-detail' : 'data-g7pb-data-list';
      root.body.innerHTML = `<section data-g7pb-data-source="${source}" data-g7pb-audience="all" data-g7pb-endpoint="${endpoint}" data-g7pb-empty-message="결과 없음"><p data-g7pb-data-status>대기</p><div ${target} aria-busy="true"></div></section>`;
      const fetcher = vi.fn(createQualityFixtureFetch(endpoint, fixtures.find(item => item.id === id)!));
      await bootDynamicData(root, fetcher);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(root.querySelector('section')!.dataset.g7pbDataReady).toBe('true');
      expect(root.querySelector(`[${target}]`)!.getAttribute('aria-busy')).toBe('false');
      expect(root.querySelector(`[${target}]`)!.children).toHaveLength(0);
      expect(root.querySelector('[data-g7pb-data-status]')!.textContent).toContain(id === 'data-empty' ? '결과 없음' : '불러오지 못했습니다');
    }
    expect(globalThis.fetch).toBe(originalFetch);
    expect(window.localStorage.getItem('auth_token')).toBe(stored);
  });

  it('rejects auth/save/publish/unexpected GET and every mutating method instead of calling a live API', async () => {
    const endpoint = '/api/modules/sirsoft-board/boards/posts/recent';
    const fixture = fixtures.find(item => item.id === 'data-empty')!;
    const fetcher = createQualityFixtureFetch(endpoint, fixture);
    for (const target of ['/api/auth/user', '/api/auth/logout', '/api/modules/jiwonpapa-page_builder/admin/documents/test/draft', '/api/modules/jiwonpapa-page_builder/admin/publications/test/commit', `${endpoint}?unexpected=true`, `https://g7pb.test${endpoint}`]) {
      await expect(fetcher(target)).rejects.toThrow('cannot escape');
    }
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']) await expect(fetcher(endpoint, { method })).rejects.toThrow('cannot escape');
    await expect(fetcher(endpoint, { body: 'cannot write' })).rejects.toThrow('cannot escape');
    await expect(fetcher(new URL(`https://g7pb.test${endpoint}`))).rejects.toThrow('cannot escape');
    await expect(fetcher(new Request(`https://g7pb.test${endpoint}`, { method: 'POST' }))).rejects.toThrow('cannot escape');
    for (const target of ['/api/auth/user', 'https://g7pb.test/api/modules/sirsoft-board/boards', '/api/modules/sirsoft-board/boards/%2e%2e/auth']) expect(() => createQualityFixtureFetch(target, fixture)).toThrow('Unsafe');
    expect(() => createQualityFixtureFetch(endpoint, fixtures[0]!)).toThrow('Unsafe');
    const response = await fetcher(endpoint, { method: 'get' });
    expect(await response.json()).toEqual({ success: true, data: [] });
  });
});
