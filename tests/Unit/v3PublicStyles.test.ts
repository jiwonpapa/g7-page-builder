// @vitest-environment node
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import fixture from '../Contract/document-v3.fixture.json';
import presentationCases from '../Contract/document-v3-presentation.json';
import behaviorCases from '../Fixtures/document-v3-cases.json';
import policy from '../../schemas/design-policy-v3.json';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';

const css = readFileSync('resources/css/page-builder-v3-public.css', 'utf8');
const properties = [...new Set([...css.matchAll(/data-g7pb-v3-style~="([^"]+)"/g)].map(match => match[1]))];
const compiler = String.raw`
require 'vendor/autoload.php';
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\Validator;
use Modules\Jiwonpapa\PageBuilder\Domain\Documents\V3\ValidatedDocument;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\HtmlCompiler;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\V3\DraftRenderer;
use Modules\Jiwonpapa\PageBuilder\Application\Compilation\HtmlDocumentCompiler;
$validator = new Validator(json_decode(file_get_contents('schemas/page-builder-document-v3.schema.json'), true, flags: JSON_THROW_ON_ERROR),
    json_decode(file_get_contents('schemas/design-policy-v3.json'), true, flags: JSON_THROW_ON_ERROR));
$results = [];
foreach (json_decode(stream_get_contents(STDIN), flags: JSON_THROW_ON_ERROR) as $input) {
    $source = json_encode($input, JSON_THROW_ON_ERROR);
    $document = ValidatedDocument::fromJson($source, $validator);
    $result = (new HtmlCompiler($validator))->compile($document, 1, 'html', HtmlDocumentCompiler::TARGET_ENGINE_VERSION);
    $drafts = [];
    foreach (['base', 'tablet', 'mobile'] as $viewport) $drafts[$viewport] = (new DraftRenderer($validator))->render($source, $viewport);
    $results[] = ['artifact' => $result->artifact, 'drafts' => $drafts];
}
echo json_encode($results, JSON_THROW_ON_ERROR);
`;

describe('one v3 publication tree follows canonical responsive presentation', () => {
  it('uses the shared breakpoint boundaries and is included in public assets', () => {
    expect(policy.breakpoints).toEqual({ tablet: 640, desktop: 1024 });
    expect(css).toContain('(640px <= width < 1024px)');
    expect(css).toContain('(width < 640px)');
    expect(readFileSync('resources/css/page-builder-public.css', 'utf8')).toContain('@import url("./page-builder-v3-public.css");');
  });

  it('matches draft geometry and styles at seven widths, including missing values, hidden nodes and common behaviors', async () => {
    const documents = [validateDocumentV3(structuredClone(fixture))];
    for (const example of presentationCases) {
      const document = structuredClone(fixture);
      const target = document.blocks[0].slots.content[0];
      documents.push(validateDocumentV3({ ...document, blocks: [{
        ...document.blocks[0], style: 'parent' in example ? example.parent : {}, responsive: {},
        slots: { content: [{ ...target, style: example.style, responsive: {} }] },
      }] }));
    }
    for (const kind of ['tabs', 'disclosure', 'carousel', 'nested'] as const) {
      documents.push(validateDocumentV3({ ...structuredClone(fixture), blocks: behaviorCases.behavior_fixtures[kind] }));
    }
    const hidden = validateDocumentV3(structuredClone(fixture));
    hidden.blocks[0].slots.content![0].style = { ...hidden.blocks[0].slots.content![0].style, hidden: true };
    documents.push(validateDocumentV3(hidden));
    const background = validateDocumentV3(structuredClone(fixture));
    background.blocks[0].style.background = { kind: 'image', asset_id: background.assets[0].asset_id, fit: 'cover', x: 25, y: 75 };
    background.blocks[0].responsive = {
      tablet: { background: { kind: 'linear', angle: 90, stops: [
        { offset: 0, color: { kind: 'hex', value: '#112233' } }, { offset: 1, color: { kind: 'hex', value: '#ffffff' } },
      ] } },
      mobile: { background: { kind: 'solid', color: { kind: 'hex', value: '#2255ff' } } },
    };
    documents.push(background);
    const axis = validateDocumentV3(structuredClone(fixture));
    axis.blocks[0].style = { display: 'flex', direction: 'row', width: { value: 250, unit: 'px' } };
    axis.blocks[0].responsive = { mobile: { direction: 'column', width: { value: 180, unit: 'px' } } };
    axis.blocks[0].slots.content = [axis.blocks[0].slots.content![0]];
    axis.blocks[0].slots.content[0].style = { width: 'fill', height: 'fill' };
    axis.blocks[0].slots.content[0].responsive = {};
    documents.push(axis);
    const frames: { artifact: string; drafts: Record<string, string> }[] = JSON.parse(execFileSync('php', ['-r', compiler], {
      input: JSON.stringify(documents), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
    }));
    const hydration = await build({ stdin: { contents: "import { ensureSiteShellButtons } from './resources/js/public/publicHydration'; ensureSiteShellButtons(document);",
      resolveDir: resolve('.') }, bundle: true, write: false, format: 'iife', platform: 'browser' });
    const browser = await chromium.launch({ headless: true });
    let comparisons = 0, maximumGeometryDifference = 0;
    try {
      const page = await browser.newPage();
      await page.route('https://v3-fixture.test/**', route => route.fulfill({
        contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"></svg>',
      }));
      const snapshot = async (html: string) => {
        await page.setContent('<!doctype html><html lang="ko"><head><base href="https://v3-fixture.test/"><style>body { margin: 0; }' + css + '</style></head><body>' + html + '</body></html>');
        await page.addScriptTag({ content: hydration.outputFiles[0].text });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map(image => image.complete ? Promise.resolve() : new Promise<void>(resolve => {
            image.onload = () => resolve(); image.onerror = () => resolve();
          })));
        });
        return page.evaluate(keys => Object.fromEntries([...document.querySelectorAll<HTMLElement>('[data-v3-node]')].map(node => {
          const style = getComputedStyle(node), rect = node.getBoundingClientRect();
          return [node.dataset.v3Node!, { tag: node.tagName, text: node.innerText, styles: Object.fromEntries(keys.map(key => [key, style.getPropertyValue(key)])),
            rect: [rect.x, rect.y, rect.width, rect.height] }];
        })), properties);
      };
      for (const width of [360, 639, 640, 768, 1023, 1024, 1280]) {
        await page.setViewportSize({ width, height: 1200 });
        const viewport = width < 640 ? 'mobile' : width < 1024 ? 'tablet' : 'base';
        for (const [index, frame] of frames.entries()) {
          const draft = await snapshot(frame.drafts[viewport]);
          const output = await snapshot(frame.artifact);
          for (const [id, expected] of Object.entries(draft)) {
            const actual = output[id], context = 'case=' + index + ' width=' + width + ' node=' + id;
            expect(actual, context).toBeDefined();
            expect(actual.tag, context).toBe(expected.tag);
            expect(actual.text, context).toBe(expected.text);
            expect(actual.styles, context).toEqual(expected.styles);
            actual.rect.forEach((value, position) => {
              const difference = Math.abs(value - expected.rect[position]);
              maximumGeometryDifference = Math.max(maximumGeometryDifference, difference);
              expect(difference, context).toBeLessThanOrEqual(1);
            });
          }
          for (const [id, actual] of Object.entries(output)) if (!draft[id]) {
            expect(actual.rect[2] * actual.rect[3], 'hidden node ' + id).toBe(0);
          }
          comparisons++;
        }
      }
      expect(comparisons).toBe(documents.length * 7);
      console.info(JSON.stringify({ comparisons, documents: documents.length, maximumGeometryDifference }));
    } finally { await browser.close(); }
  }, 60000);
});
