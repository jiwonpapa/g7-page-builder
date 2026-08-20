import { describe, expect, it } from 'vitest';

import {
  filterRouteCatalog,
  parseRouteTargetOptions,
  resolveRoutePath,
} from '../../resources/js/editor/RouteUrlField';
import type { RouteCatalogEntry } from '../../resources/js/documents/types';

const routes: RouteCatalogEntry[] = [
  {
    id: 'auth.login', label: '로그인', category: '회원', path: '/login',
    auth_required: false, guest_only: true, parameters: [], parameter_sources: {},
    source: { kind: 'template', identifier: null },
  },
  {
    id: 'board.detail', label: '게시판', category: '게시판', path: '/board/:slug',
    auth_required: false, guest_only: false, parameters: ['slug'], parameter_sources: { slug: 'board' },
    source: { kind: 'template', identifier: null },
  },
];

describe('route URL field helpers', () => {
  it('filters routes by Korean label, path, and category', () => {
    expect(filterRouteCatalog(routes, '로그')).toEqual([routes[0]]);
    expect(filterRouteCatalog(routes, '/board')).toEqual([routes[1]]);
    expect(filterRouteCatalog(routes, '게시판')).toEqual([routes[1]]);
  });

  it('resolves encoded route parameters and rejects missing values', () => {
    expect(resolveRoutePath(routes[1], { slug: '공지 사항' })).toBe('/board/%EA%B3%B5%EC%A7%80%20%EC%82%AC%ED%95%AD');
    expect(resolveRoutePath(routes[1], {})).toBeNull();
    expect(resolveRoutePath(routes[0], {})).toBe('/login');
  });

  it('normalizes G7 board, nested category, and paginated product targets for selectors', () => {
    expect(parseRouteTargetOptions('board', {
      success: true,
      data: [{ slug: 'notice', name: '공지사항' }],
    })).toEqual([{ value: 'notice', label: '공지사항' }]);
    expect(parseRouteTargetOptions('category', {
      success: true,
      data: [{ slug: 'living', name_localized: '생활', children: [{ slug: 'lamp', name_localized: '조명' }] }],
    })).toEqual([
      { value: 'living', label: '생활' },
      { value: 'lamp', label: '— 조명' },
    ]);
    expect(parseRouteTargetOptions('product', {
      success: true,
      data: { data: [{ product_code: 'SKU-7', name_localized: '의자' }] },
    })).toEqual([{ value: 'SKU-7', label: '의자' }]);
  });
});
