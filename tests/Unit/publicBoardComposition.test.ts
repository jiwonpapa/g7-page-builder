import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootDynamicData, disposePublicDataRuntime } from '../../resources/js/public/publicDataRuntime';

const roots: Document[] = [];
afterEach(() => { roots.splice(0).forEach(disposePublicDataRuntime); localStorage.removeItem('auth_token'); document.body.replaceChildren(); });
function fixture() {
  const root = document.implementation.createHTMLDocument('support'); roots.push(root);
  root.body.innerHTML = '<h1>고객 지원</h1><section data-g7pb-data-source="posts" data-g7pb-data-limit="3" data-g7pb-endpoint="/api/modules/sirsoft-board/boards/notice/posts?per_page=3"><p data-g7pb-data-status></p><div data-g7pb-data-list></div></section>';
  return root;
}
const payload = { success: true, data: { board: { slug: 'notice', name: '공지사항' },
  data: [1, 2, 3, 4].map(id => ({ id, slug: 'notice', title: `소식 ${id}` })) } };

describe('general page with a selected G7 board', () => {
  it('uses the existing G7 visitor credentials for audience and per-board permission checks', async () => {
    document.body.innerHTML = fixture().body.innerHTML; roots.push(document);
    document.querySelector('section')?.setAttribute('data-g7pb-audience', 'member');
    localStorage.setItem('auth_token', 'test-member-token');
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify(payload)));
    await bootDynamicData(document, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    for (const [, options] of fetcher.mock.calls) expect(options?.headers).toEqual({ Accept: 'application/json', Authorization: 'Bearer test-member-token' });
    expect(document.querySelectorAll('article')).toHaveLength(3);
  });

  it('normalizes the real per-board envelope, caps notices and links to actual post routes', async () => {
    const root = fixture(); const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload)));
    await bootDynamicData(root, fetcher);
    expect(root.querySelectorAll('article')).toHaveLength(3);
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/board/notice/1');
    expect(root.querySelector('article span')?.textContent).toBe('공지사항');
    expect(root.querySelector('h1')?.textContent).toBe('고객 지원');
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/boards/notice/posts?'), expect.objectContaining({ credentials: 'same-origin' }));
  });

  it.each([
    [200, { success: true, data: { board: { slug: 'notice' }, data: [] } }, '표시할 항목이 없습니다.'],
    [401, null, '콘텐츠를 볼 수 있는 권한이 없습니다.'],
    [403, null, '콘텐츠를 볼 수 있는 권한이 없습니다.'],
    [404, null, '연결된 콘텐츠를 찾을 수 없습니다.'],
    [500, null, '콘텐츠를 불러오지 못했습니다.'],
    [200, { success: false, data: [] }, '콘텐츠를 불러오지 못했습니다.'],
    [200, { success: true, data: {} }, '콘텐츠를 불러오지 못했습니다.'],
    [200, { success: true, data: [null] }, '콘텐츠를 불러오지 못했습니다.'],
    [200, { success: true, data: [{ title: '주소 없는 글' }] }, '콘텐츠를 불러오지 못했습니다.'],
  ])('keeps static content and distinguishes response %s / %j', async (status, data, message) => {
    const root = fixture();
    await bootDynamicData(root, vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(data), { status })));
    expect(root.querySelector('[data-g7pb-data-status]')?.textContent).toContain(message);
    expect(root.querySelector('[data-g7pb-data-list]')?.getAttribute('aria-busy')).toBe('false');
    expect(root.querySelectorAll('article')).toHaveLength(0);
    expect(root.querySelector('h1')?.textContent).toBe('고객 지원');
  });

  it('renders untrusted titles as text', async () => {
    const root = fixture();
    await bootDynamicData(root, vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true, data: { board: { slug: 'notice' }, data: [{ id: 1, title: '<img src=x onerror=alert(1)>' }] },
    }))));
    expect(root.querySelector('strong')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(root.querySelector('img')).toBeNull();
  });
});
