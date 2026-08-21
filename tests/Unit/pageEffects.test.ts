import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bootDynamicData,
  bootInquiryForms,
  bootPageEffects,
  bootServiceActions,
  ensureSliderControls,
  parseCounterText,
} from '../../resources/js/public/pageEffects';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete document.documentElement.dataset.g7pbServiceActionsReady;
  vi.restoreAllMocks();
});

describe('published page effects runtime', () => {
  it('parses localized numeric labels while preserving their prefix and suffix', () => {
    expect(parseCounterText('12,400+')).toEqual({ prefix: '', value: 12400, suffix: '+', decimals: 0 });
    expect(parseCounterText('가용성 99.9%')).toEqual({ prefix: '가용성 ', value: 99.9, suffix: '%', decimals: 1 });
    expect(parseCounterText('숫자 없음')).toBeNull();
  });

  it('activates typed effects and keeps the DOM content accessible without IntersectionObserver', () => {
    document.body.innerHTML = `
      <main class="g7pb-page">
        <section class="g7pb-block" data-g7pb-motion="stagger" data-g7pb-motion-stagger="60"><div class="g7pb-features__grid"><article class="g7pb-features__item">첫째</article><article class="g7pb-features__item">둘째</article></div></section>
        <section class="g7pb-block" data-g7pb-motion="counter" data-g7pb-motion-intensity="normal"><div class="g7pb-stats__grid"><article><strong>12,400+</strong></article></div></section>
        <section class="g7pb-block" data-g7pb-motion="chart-draw"><progress max="100" value="74">74</progress></section>
        <section class="g7pb-block" data-g7pb-motion="parallax-soft"><figure><img src="/safe.webp" alt="안전"></figure></section>
      </main>`;
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(performance.now() + 2_000);
      return 1;
    });

    bootPageEffects(document, window);

    expect(document.querySelector('.g7pb-page')?.classList.contains('g7pb-motion-active')).toBe(true);
    expect(document.querySelectorAll('.is-inview')).toHaveLength(4);
    expect(document.querySelectorAll('[data-g7pb-motion-item]')).toHaveLength(3);
    expect(document.querySelector('.g7pb-motion-parallax-target')).not.toBeNull();
    expect(document.querySelector('[data-g7pb-counter-original]')?.textContent).toBe('12,400+');
    expect(document.querySelector('strong')?.getAttribute('aria-label')).toBe('12,400+');
  });

  it('does not install motion when the visitor asks for reduced motion', () => {
    document.body.innerHTML = '<main class="g7pb-page"><section class="g7pb-block" data-g7pb-motion="reveal">항상 보이는 콘텐츠</section></main>';
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));

    bootPageEffects(document, window);

    const page = document.querySelector<HTMLElement>('.g7pb-page');
    expect(page?.dataset.g7pbMotionReduced).toBe('true');
    expect(page?.classList.contains('g7pb-motion-active')).toBe(false);
    expect(document.body.textContent).toContain('항상 보이는 콘텐츠');
  });

  it('opens and closes the accessible mobile site menu without hiding desktop navigation', () => {
    document.body.innerHTML = `
      <header data-g7pb-site-header>
        <button type="button" aria-expanded="false" aria-controls="site-menu" data-g7pb-menu-toggle>메뉴</button>
        <nav id="site-menu" data-g7pb-mobile-menu hidden><a href="/pages/about">소개</a></nav>
      </header>
      <main class="g7pb-page"></main>`;

    bootPageEffects(document, window);
    const toggle = document.querySelector<HTMLButtonElement>('[data-g7pb-menu-toggle]');
    const menu = document.querySelector<HTMLElement>('[data-g7pb-mobile-menu]');

    toggle?.click();
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(menu?.hidden).toBe(false);
    expect(document.documentElement.classList.contains('g7pb-menu-open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(menu?.hidden).toBe(true);
    expect(document.activeElement).toBe(toggle);
  });

  it('traps keyboard focus inside a drawer menu and restores it when the backdrop closes', () => {
    document.body.innerHTML = `
      <header data-g7pb-site-header>
        <button type="button" aria-expanded="false" aria-controls="drawer-menu" data-g7pb-menu-toggle>메뉴</button>
        <button type="button" data-g7pb-menu-backdrop hidden>메뉴 닫기</button>
        <nav id="drawer-menu" data-g7pb-mobile-menu data-g7pb-menu-style="drawer-right" hidden>
          <button type="button" data-g7pb-menu-close>닫기</button>
          <a href="/pages/about">소개</a><a href="/pages/contact">문의</a>
        </nav>
      </header>`;

    bootPageEffects(document, window);
    const toggle = document.querySelector<HTMLButtonElement>('[data-g7pb-menu-toggle]')!;
    const backdrop = document.querySelector<HTMLButtonElement>('[data-g7pb-menu-backdrop]')!;
    const focusable = Array.from(document.querySelectorAll<HTMLElement>('[data-g7pb-mobile-menu] button, [data-g7pb-mobile-menu] a'));
    toggle.click();
    expect(document.activeElement).toBe(focusable[0]);
    focusable.at(-1)?.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(focusable[0]);
    backdrop.click();
    expect(document.activeElement).toBe(toggle);
    expect(backdrop.hidden).toBe(true);
  });

  it('submits a typed inquiry with CSRF and restores a reusable success state', async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="csrf-test">';
    document.body.innerHTML = `
      <section data-block-id="123e4567-e89b-42d3-a456-426614174099">
        <form action="/pages/contact/inquiries" data-g7pb-inquiry-form data-g7pb-success-message="접수 완료">
          <input type="hidden" name="block_instance_id"><input type="hidden" name="started_at">
          <input name="form_kind" value="inquiry"><input name="website" value="">
          <input required name="name" value="홍길동"><input required type="email" name="email" value="hello@example.com">
          <textarea required name="message">문의 내용</textarea><input required type="checkbox" name="privacy" value="1" checked>
          <p data-g7pb-form-status></p><button type="submit">문의 보내기</button>
        </form>
      </section>`;
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ success: true, message: '문의가 접수되었습니다.' }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }));

    bootInquiryForms(document, fetcher as typeof fetch);
    const form = document.querySelector<HTMLFormElement>('form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    const [, init] = fetcher.mock.calls[0]!;
    expect(init?.headers).toMatchObject({ Accept: 'application/json', 'X-CSRF-TOKEN': 'csrf-test' });
    expect((init?.body as FormData).get('block_instance_id')).toBe('123e4567-e89b-42d3-a456-426614174099');
    await vi.waitFor(() => expect(document.querySelector('[data-g7pb-form-status]')?.textContent).toBe('접수 완료'));
    expect(document.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(form.dataset.g7pbFormReady).toBe('true');
  });

  it('restores slider controls removed by the active template HTML sanitizer', () => {
    document.body.innerHTML = `
      <section data-g7pb-slider>
        <div class="g7pb-hero-slider__viewport"></div>
        <div class="g7pb-hero-slider__controls"><div data-g7pb-slider-dots></div></div>
        <p data-g7pb-slider-status></p>
      </section>`;
    const slider = document.querySelector<HTMLElement>('[data-g7pb-slider]');

    ensureSliderControls(document, slider!, true);

    expect(slider?.querySelector('[data-g7pb-slider-prev]')).not.toBeNull();
    expect(slider?.querySelector('[data-g7pb-slider-next]')).not.toBeNull();
    expect(slider?.querySelector('[data-g7pb-slider-toggle]')?.textContent).toBe('일시 정지');
  });

  it('executes only the typed G7 logout action and clears the local bearer token after success', async () => {
    const root = document.implementation.createHTMLDocument('logout action');
    root.body.innerHTML = '<a href="#g7-action-logout"><span>로그아웃</span></a>';
    let token: string | null = 'test-token';
    const storage = {
      getItem: vi.fn(() => token),
      removeItem: vi.fn(() => { token = null; }),
    };
    const fetcher = vi.fn(async () => new Response('{}', { status: 200 }));
    const navigate = vi.fn();

    bootServiceActions(root, window, fetcher as typeof fetch, navigate, storage);
    root.querySelector('span')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());

    expect(fetcher).toHaveBeenCalledWith('/api/user/auth/logout', expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
    expect(token).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('renders G7 posts and products through public APIs without injecting response HTML', async () => {
    document.body.innerHTML = `
      <section data-g7pb-data-source="posts" data-g7pb-endpoint="/api/posts" data-g7pb-audience="all" data-g7pb-empty-message="글 없음">
        <p data-g7pb-data-status></p><div data-g7pb-data-list aria-busy="true"></div>
      </section>
      <section data-g7pb-data-source="products" data-g7pb-endpoint="/api/products" data-g7pb-audience="all" data-g7pb-product-base="/shop/products" data-g7pb-empty-message="상품 없음">
        <p data-g7pb-data-status></p><div data-g7pb-data-list aria-busy="true"></div>
      </section>`;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/posts') {
        return new Response(JSON.stringify({ success: true, data: [{ id: 7, board_slug: 'notice', board_name: '공지', title: '<img src=x onerror=alert(1)>', created_at_formatted: '방금 전' }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, data: { data: [{ id: 9, product_code: 'SKU-9', name: '<script>alert(1)</script>', thumbnail_url: 'javascript:alert(1)', selling_price_formatted: '29,000원' }] } }), { status: 200 });
    });

    await bootDynamicData(document, fetcher as typeof fetch);

    expect(document.querySelector('[data-g7pb-data-source="posts"] a')?.getAttribute('href')).toBe('/board/notice/7');
    expect(document.querySelector('[data-g7pb-data-source="posts"] strong')?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(document.querySelector('[data-g7pb-data-source="posts"] img')).toBeNull();
    expect(document.querySelector('[data-g7pb-data-source="products"] a')?.getAttribute('href')).toBe('/shop/products/SKU-9');
    expect(document.querySelector('[data-g7pb-data-source="products"] strong')?.textContent).toBe('<script>alert(1)</script>');
    expect(document.querySelector('[data-g7pb-data-source="products"] script')).toBeNull();
    expect(document.querySelectorAll('[aria-busy="false"]')).toHaveLength(2);
  });

  it('shows member-only data to members and keeps it hidden from guests', async () => {
    document.body.innerHTML = `
      <section data-g7pb-data-source="posts" data-g7pb-endpoint="/api/posts" data-g7pb-audience="member" hidden>
        <p data-g7pb-data-status></p><div data-g7pb-data-list></div>
      </section>`;
    const memberFetch = vi.fn(async (input: RequestInfo | URL) => new Response(JSON.stringify(
      String(input) === '/api/user/auth/user'
        ? { success: true, data: { id: 1 } }
        : { success: true, data: [] },
    ), { status: 200 }));

    await bootDynamicData(document, memberFetch as typeof fetch);
    expect(document.querySelector<HTMLElement>('section')?.hidden).toBe(false);
    expect(memberFetch).toHaveBeenCalledWith('/api/user/auth/user', expect.any(Object));
  });
});
