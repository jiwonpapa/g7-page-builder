import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bootAccordions,
  bootBlockVisibility,
  bootDynamicData,
  bootG7SystemControls,
  bootInquiryForms,
  bootPageEffects,
  bootServiceActions,
  bootTabs,
  ensureSliderControls,
  ensureSiteShellButtons,
  parseCounterText,
} from '../../resources/js/public/pageEffects';

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete document.documentElement.dataset.g7pbServiceActionsReady;
  delete document.documentElement.dataset.g7pbSystemControlsReady;
  delete (window as unknown as { G7Core?: unknown }).G7Core;
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('published page effects runtime', () => {
  it('keeps single FAQ accordions exclusive and makes tabs keyboard accessible', () => {
    document.body.innerHTML = `
      <section data-block-id="123e4567-e89b-42d3-a456-426614174099" data-g7pb-accordion data-g7pb-accordion-behavior="single">
        <details open><summary>첫 질문</summary><p>첫 답변</p></details>
        <details><summary>둘째 질문</summary><p>둘째 답변</p></details>
      </section>
      <section data-block-id="223e4567-e89b-42d3-a456-426614174099" data-g7pb-tabs data-g7pb-tabs-initial="1">
        <div role="tablist"><button role="tab">기획</button><button role="tab">운영</button></div>
        <article role="tabpanel">기획 내용</article><article role="tabpanel">운영 내용</article>
      </section>`;

    bootAccordions(document);
    bootTabs(document);
    const details = Array.from(document.querySelectorAll<HTMLDetailsElement>('details'));
    details[1].open = true;
    details[1].dispatchEvent(new Event('toggle'));
    expect(details[0].open).toBe(false);
    expect(details[1].open).toBe(true);

    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panels = Array.from(document.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(panels[0].hidden).toBe(true);
    expect(tabs[0].getAttribute('aria-controls')).toBe(panels[0].id);
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tabs[0]);
    expect(panels[0].hidden).toBe(false);
    expect(panels[1].hidden).toBe(true);
  });

  it('parses localized numeric labels while preserving their prefix and suffix', () => {
    expect(parseCounterText('12,400+')).toEqual({ prefix: '', value: 12400, suffix: '+', decimals: 0 });
    expect(parseCounterText('가용성 99.9%')).toEqual({ prefix: '가용성 ', value: 99.9, suffix: '%', decimals: 1 });
    expect(parseCounterText('숫자 없음')).toBeNull();
  });

  it('activates typed effects and keeps the DOM content accessible without IntersectionObserver', () => {
    document.body.innerHTML = `
      <main class="g7pb-page">
        <section class="g7pb-block" data-g7pb-motion="stagger" data-g7pb-motion-stagger="60"><div class="g7pb-features__grid"><article class="g7pb-features__item">첫째</article><article class="g7pb-features__item">둘째</article></div></section>
        <section class="g7pb-block" data-g7pb-motion="stagger" data-g7pb-motion-stagger="100"><ul class="g7pb-icon-list__items"><li class="g7pb-icon-list__item">빠름</li><li class="g7pb-icon-list__item">안전</li></ul></section>
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
    expect(document.querySelectorAll('.is-inview')).toHaveLength(5);
    expect(document.querySelectorAll('[data-g7pb-motion-item]')).toHaveLength(5);
    expect(document.querySelectorAll('.g7pb-icon-list__item[data-g7pb-motion-item]')).toHaveLength(2);
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

  it('restores fixed menu buttons removed by the G7 HtmlContent sanitizer', () => {
    document.body.innerHTML = `
      <span class="g7pb-menu-toggle" data-g7pb-menu-toggle aria-expanded="false"><span></span></span>
      <span data-g7pb-menu-backdrop hidden></span>
      <nav data-g7pb-mobile-menu><span data-g7pb-menu-close>×</span>
        <span data-g7pb-submenu-toggle aria-expanded="false"><span>⌄</span></span>
      </nav>`;

    ensureSiteShellButtons(document);

    expect(document.querySelector('[data-g7pb-menu-toggle]')?.tagName).toBe('BUTTON');
    expect(document.querySelector('[data-g7pb-menu-backdrop]')?.tagName).toBe('BUTTON');
    expect(document.querySelector('[data-g7pb-menu-close]')?.tagName).toBe('BUTTON');
    expect(document.querySelector('[data-g7pb-submenu-toggle]')?.tagName).toBe('BUTTON');
    expect(document.querySelector('[data-g7pb-menu-toggle]')?.getAttribute('aria-expanded')).toBe('false');
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

  it('expands one nested mobile route group and resets it when the drawer closes', () => {
    document.body.innerHTML = `
      <header data-g7pb-site-header>
        <button type="button" aria-expanded="false" aria-controls="nested-menu" data-g7pb-menu-toggle>메뉴</button>
        <nav id="nested-menu" data-g7pb-mobile-menu data-g7pb-menu-style="drawer-left" hidden>
          <div class="g7pb-mobile-menu__row">
            <a href="/pages/services">서비스</a>
            <button type="button" aria-expanded="false" aria-controls="service-routes" aria-label="서비스 하위 메뉴 열기" data-g7pb-submenu-toggle>펼침</button>
          </div>
          <ul id="service-routes" data-g7pb-mobile-submenu hidden><li><a href="/pages/features">기능</a></li></ul>
        </nav>
      </header>`;

    bootPageEffects(document, window);
    const menuToggle = document.querySelector<HTMLButtonElement>('[data-g7pb-menu-toggle]')!;
    const submenuToggle = document.querySelector<HTMLButtonElement>('[data-g7pb-submenu-toggle]')!;
    const submenu = document.querySelector<HTMLElement>('[data-g7pb-mobile-submenu]')!;
    menuToggle.click();
    submenuToggle.click();
    expect(submenuToggle.getAttribute('aria-expanded')).toBe('true');
    expect(submenuToggle.getAttribute('aria-label')).toContain('닫기');
    expect(submenu.hidden).toBe(false);

    menuToggle.click();
    expect(submenuToggle.getAttribute('aria-expanded')).toBe('false');
    expect(submenuToggle.getAttribute('aria-label')).toContain('열기');
    expect(submenu.hidden).toBe(true);
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

  it('keeps fixed G7 account, cart, locale, currency, and theme controls outside the editable document', () => {
    document.documentElement.lang = 'ko';
    document.body.innerHTML = `
      <nav data-g7pb-system-controls>
        <span data-g7pb-system-search-host data-g7pb-label="검색" data-g7pb-placeholder="통합 검색"></span>
        <a data-g7pb-system-member hidden>회원</a><a data-g7pb-system-guest>비회원</a>
        <a data-g7pb-system-cart><span data-g7pb-system-cart-count hidden></span></a>
        <span data-g7pb-system-notification-count hidden></span>
        <button data-g7pb-system-theme>테마</button>
        <label data-g7pb-system-locale-wrap hidden><select data-g7pb-system-locale></select></label>
        <label data-g7pb-system-currency-wrap hidden><select data-g7pb-system-currency></select></label>
      </nav>`;
    const dispatch = vi.fn();
    const subscribe = vi.fn();
    (window as unknown as { G7Core: unknown }).G7Core = {
      state: {
        get: () => ({
          currentUser: { uuid: 'member-1' }, cartCount: 3, notificationCount: 2,
          shopBase: '/store', preferredCurrency: 'KRW',
          availableCurrencies: [{ code: 'KRW', symbol: '₩' }, { code: 'USD', symbol: '$' }],
          appConfig: { supportedLocales: ['ko', 'en'], localeNames: { ko: '한국어', en: 'English' } },
        }),
        subscribe,
      },
      dispatch,
    };

    bootG7SystemControls(document, window as never);

    expect(document.querySelector<HTMLElement>('[data-g7pb-system-member]')?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-g7pb-system-guest]')?.hidden).toBe(true);
    expect(document.querySelector<HTMLAnchorElement>('[data-g7pb-system-cart]')?.getAttribute('href')).toBe('/store/cart');
    expect(document.querySelector('[data-g7pb-system-cart-count]')?.textContent).toBe('3');
    expect(document.querySelector('[data-g7pb-system-notification-count]')?.textContent).toBe('2');
    expect(document.querySelector<HTMLElement>('[data-g7pb-system-locale-wrap]')?.hidden).toBe(false);
    expect(document.querySelectorAll('[data-g7pb-system-locale] option')).toHaveLength(2);
    expect(document.querySelector<HTMLElement>('[data-g7pb-system-currency-wrap]')?.hidden).toBe(false);

    const search = document.querySelector<HTMLInputElement>('[data-g7pb-system-search-host] input[name="q"]')!;
    search.value = '통합 셸';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    search.closest('form')?.remove();

    const cartBadgeText = document.querySelector('[data-g7pb-system-cart-count]')?.firstChild;
    const notificationBadgeText = document.querySelector('[data-g7pb-system-notification-count]')?.firstChild;
    const firstLocaleOption = document.querySelector('[data-g7pb-system-locale] option');
    bootG7SystemControls(document, window as never);
    expect(document.querySelector('[data-g7pb-system-cart-count]')?.firstChild).toBe(cartBadgeText);
    expect(document.querySelector('[data-g7pb-system-notification-count]')?.firstChild).toBe(notificationBadgeText);
    expect(document.querySelector('[data-g7pb-system-locale] option')).toBe(firstLocaleOption);
    expect(document.querySelector<HTMLInputElement>('[data-g7pb-system-search-host] input[name="q"]')?.value).toBe('통합 셸');

    const locale = document.querySelector<HTMLSelectElement>('[data-g7pb-system-locale]')!;
    locale.value = 'en';
    locale.dispatchEvent(new Event('change', { bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith({ handler: 'setLocale', target: 'en' });

    const currency = document.querySelector<HTMLSelectElement>('[data-g7pb-system-currency]')!;
    currency.value = 'USD';
    currency.dispatchEvent(new Event('change', { bubbles: true }));
    expect(dispatch).toHaveBeenCalledWith({
      handler: 'sirsoft-basic.savePreferredCurrency',
      params: { currencyCode: 'USD' },
    });

    document.querySelector<HTMLButtonElement>('[data-g7pb-system-theme]')?.click();
    expect(dispatch).toHaveBeenCalledWith({ handler: 'setTheme', target: 'light' });
    expect(subscribe).toHaveBeenCalledOnce();
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

  it('filters the G7 content archive by title and board without another network request', async () => {
    document.body.innerHTML = `
      <section data-g7pb-data-source="post-archive" data-g7pb-endpoint="/api/archive" data-g7pb-audience="all" data-g7pb-empty-message="검색 결과 없음">
        <input data-g7pb-archive-search><select data-g7pb-archive-filter><option value="">전체 게시판</option></select>
        <p data-g7pb-data-status></p><div data-g7pb-data-list aria-busy="true"></div>
      </section>`;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, data: [
      { id: 1, board_slug: 'notice', board_name: '공지', title: '새 기능 안내', created_at_formatted: '오늘' },
      { id: 2, board_slug: 'guide', board_name: '가이드', title: '운영 시작하기', created_at_formatted: '어제' },
    ] }), { status: 200 }));

    await bootDynamicData(document, fetcher as typeof fetch);
    const search = document.querySelector<HTMLInputElement>('[data-g7pb-archive-search]')!;
    const filter = document.querySelector<HTMLSelectElement>('[data-g7pb-archive-filter]')!;
    const articles = Array.from(document.querySelectorAll<HTMLElement>('article'));
    expect(filter.options).toHaveLength(3);

    search.value = '운영';
    search.dispatchEvent(new Event('input'));
    expect(articles.map((article) => article.hidden)).toEqual([true, false]);

    search.value = '';
    filter.value = '공지';
    filter.dispatchEvent(new Event('change'));
    expect(articles.map((article) => article.hidden)).toEqual([false, true]);

    search.value = '없는 제목';
    search.dispatchEvent(new Event('input'));
    expect(document.querySelector('[data-g7pb-data-status]')?.textContent).toBe('검색 결과 없음');
    expect(fetcher).toHaveBeenCalledOnce();
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

  it('applies generic block visibility with one cached audience request', async () => {
    document.body.innerHTML = `
      <section data-g7pb-visibility-audience="member" hidden>회원 안내</section>
      <section data-g7pb-visibility-audience="guest" hidden>비회원 안내</section>
      <section data-g7pb-visibility-audience="all">공통 안내</section>`;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { id: 1 } }), { status: 200 }));

    await bootBlockVisibility(document, fetcher as typeof fetch);
    const blocks = Array.from(document.querySelectorAll<HTMLElement>('section'));
    expect(blocks.map((block) => block.hidden)).toEqual([false, true, false]);
    expect(blocks.map((block) => block.dataset.g7pbVisibilityReady)).toEqual(['true', 'true', 'true']);
    await bootBlockVisibility(document, fetcher as typeof fetch);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('paginates loaded lists locally without another API request', async () => {
    document.body.innerHTML = `
      <section data-g7pb-data-source="posts" data-g7pb-endpoint="/api/posts" data-g7pb-audience="all" data-g7pb-page-size="2">
        <p data-g7pb-data-status></p><div data-g7pb-data-list></div>
        <nav data-g7pb-pagination hidden><button data-g7pb-page-prev>이전</button><span data-g7pb-page-status></span><button data-g7pb-page-next>다음</button></nav>
      </section>`;
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ success: true, data: Array.from({ length: 5 }, (_, index) => ({
      id: index + 1, board_slug: 'notice', board_name: '공지', title: `게시글 ${index + 1}`, created_at_formatted: '오늘',
    })) }), { status: 200 }));

    await bootDynamicData(document, fetcher as typeof fetch);
    const articles = Array.from(document.querySelectorAll<HTMLElement>('article'));
    expect(articles.map((article) => article.hidden)).toEqual([false, false, true, true, true]);
    expect(document.querySelector('[data-g7pb-page-status]')?.textContent).toBe('1 / 3');
    expect(document.querySelector<HTMLElement>('[data-g7pb-pagination]')?.hidden).toBe(false);
    document.querySelector<HTMLButtonElement>('[data-g7pb-page-next]')?.click();
    expect(articles.map((article) => article.hidden)).toEqual([true, true, false, false, true]);
    expect(document.querySelector('[data-g7pb-page-status]')?.textContent).toBe('2 / 3');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('renders selected G7 post and product details as safe text', async () => {
    document.body.innerHTML = `
      <section data-g7pb-data-source="post-detail" data-g7pb-endpoint="/api/post/17" data-g7pb-audience="all" data-g7pb-detail-url="/board/notice/17" data-g7pb-detail-label="전체 보기" data-g7pb-show-content="true">
        <p data-g7pb-data-status></p><div data-g7pb-data-detail aria-busy="true"></div>
      </section>
      <section data-g7pb-data-source="product-detail" data-g7pb-endpoint="/api/product/SKU-17" data-g7pb-audience="all" data-g7pb-detail-url="/shop/products/SKU-17" data-g7pb-detail-label="상품 보기" data-g7pb-show-description="true">
        <p data-g7pb-data-status></p><div data-g7pb-data-detail aria-busy="true"></div>
      </section>`;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/post/')) return new Response(JSON.stringify({ success: true, data: {
        id: 17, title: '<img src=x onerror=alert(1)>공지', content: '<p>안전한 <strong>본문</strong></p><script>alert(1)</script>',
        author: { name: '관리자' }, created_at_formatted: '오늘', view_count: 12, thumbnail: 'javascript:alert(1)',
      } }), { status: 200 });
      return new Response(JSON.stringify({ success: true, data: {
        product_code: 'SKU-17', name_localized: '<script>상품</script>', category_name: '기획 상품',
        selling_price_formatted: '39,000원', short_description_localized: '<b>대표 설명</b>', thumbnail_url: 'javascript:alert(1)',
      } }), { status: 200 });
    });

    await bootDynamicData(document, fetcher as typeof fetch);
    const details = Array.from(document.querySelectorAll<HTMLElement>('[data-g7pb-data-detail]'));
    expect(details[0]?.querySelector('h3')?.textContent).toBe('<img src=x onerror=alert(1)>공지');
    expect(details[0]?.textContent).toContain('안전한 본문');
    expect(details[0]?.querySelector('script')).toBeNull();
    expect(details[0]?.querySelector('img')).toBeNull();
    expect(details[0]?.querySelector('a')?.getAttribute('href')).toBe('/board/notice/17');
    expect(details[1]?.querySelector('h3')?.textContent).toBe('<script>상품</script>');
    expect(details[1]?.textContent).toContain('대표 설명');
    expect(details[1]?.querySelector('script')).toBeNull();
    expect(details[1]?.querySelector('a')?.getAttribute('href')).toBe('/shop/products/SKU-17');
    expect(details.map((detail) => detail.getAttribute('aria-busy'))).toEqual(['false', 'false']);
  });
});
