import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const slugs = ['service-conversion', 'local-business', 'editorial-community'];
const read = (path: string): any => JSON.parse(readFileSync(resolve(path), 'utf8'));

function collectUrls(value: unknown, key = ''): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => collectUrls(item, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([childKey, child]) => collectUrls(child, childKey));
  }
  return typeof value === 'string' && /(?:url|Url)$/.test(key) ? [value] : [];
}

describe('phase 6 representative Page Kit quality', () => {
  it('removes root placeholder actions from the three reworked kits', () => {
    for (const slug of slugs) {
      const document = read(`resources/store/source/page-kits/${slug}/document.json`);
      expect(collectUrls(document), slug).not.toContain('/');
    }
  });

  it('marks illustrative people and location data as samples instead of customer claims', () => {
    const service = read('resources/store/source/page-kits/service-conversion/document.json');
    const local = read('resources/store/source/page-kits/local-business/document.json');
    const serviceCases = service.blocks.find((block: any) => block.type === 'trust.testimonials-01').props.items;
    const localCases = local.blocks.find((block: any) => block.type === 'trust.testimonials-01').props.items;
    expect([...serviceCases, ...localCases].every((item: any) => item.company === '샘플 콘텐츠' && item.role.startsWith('가상'))).toBe(true);
    const location = local.blocks.find((block: any) => block.type === 'location.map-directions-01');
    expect(location.props.address).toContain('예시 주소');
  });
});
