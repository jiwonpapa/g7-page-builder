import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface LayoutNode {
  id: string;
  type: string;
  name: string;
  if?: string;
  props?: Record<string, unknown>;
  children?: LayoutNode[];
}

describe('module-owned template document language', () => {
  for (const kind of ['home', 'public', 'preview']) {
    it(`binds ${kind} body language without changing the host or HtmlContent sanitizer`, () => {
      const layout = JSON.parse(readFileSync(`resources/layouts/user/page_builder_${kind}.json`, 'utf8')) as {
        extends: string; slots: { content: LayoutNode[] };
      };
      expect(layout.extends).toBe('_user_base');
      const body = layout.slots.content.find(node => node.id === `page_builder_${kind}_body`);
      expect(body).toEqual({
        id: `page_builder_${kind}_body`, type: 'basic', name: 'Div',
        if: '{{page?.data?.page?.artifact}}',
        props: { lang: "{{page?.data?.page?.locale ?? ''}}", className: 'g7pb-template-body' },
        children: [{
          id: `page_builder_${kind}_content`, type: 'composite', name: 'HtmlContent',
          props: { content: "{{page?.data?.page?.artifact ?? ''}}", isHtml: true,
            className: 'g7pb-page g7pb-template-page' },
        }],
      });
      // No hard-coded Korean fallback and no language override on template siblings.
      expect(layout.slots.content.filter(node => node !== body).every(node => !node.props?.lang)).toBe(true);
    });
  }
});
