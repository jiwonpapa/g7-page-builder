import { expect, it } from 'vitest';
import documents from '../../resources/compositions/builtin-v3.json';
import manifest from '../../resources/block-packs/builtin-core/manifest.json';
import fixture from '../Contract/document-v3.fixture.json';
import { compositionChoices, compositionClipboard } from '../../resources/js/editor-application/v3/compositions';
import { validateDocumentV3 } from '../../resources/js/documents/v3/validate';
import { executeDocumentCommand } from '../../resources/js/documents/v3/designCommands';
import { indexTree } from '../../resources/js/documents/v3/tree';

const presets = manifest.presets.filter(preset => preset.block_id === 'form.inquiry-01');
const forms = compositionChoices(documents.slice(63));
const uuid = (n: number) => '30000000-0000-4000-8000-' + String(n).padStart(12, '0');

it('maps every existing inquiry preset to a declarative document without editing the legacy catalog', () => {
  expect(forms).toHaveLength(5);
  expect(forms.map(choice => choice.source.slug)).toEqual(presets.map(preset => preset.preset_id.replaceAll('.', '-')));
  expect(forms.map(choice => choice.label)).toEqual(presets.map(preset => preset.label.ko));
  for (const choice of forms) {
    expect(choice.source.assets).toEqual([]);
    expect(choice.source.shell_mode).toBe('none');
    expect(choice.source.blocks).toHaveLength(1);
  }
});

for (const [index, choice] of forms.entries()) it(choice.label + ': keeps editable elements, responsive input affordance and remapped service roles', () => {
  const source = choice.source, before = JSON.stringify(source), tree = indexTree(source);
  const preset = presets[index], host = [...tree.values()].find(item => item.node.binding)!.node;
  const binding = host.binding!;
  expect(binding.form_kind).toBe(preset.props.formKind);
  expect(binding.success_message).toBe(preset.props.successMessage);
  expect(binding.fields.map(field => field.name)).toEqual(preset.props.showPhone
    ? ['name', 'email', 'phone', 'subject', 'message', 'privacy'] : ['name', 'email', 'message', 'privacy']);
  expect(host.style.columns).toEqual([{ fr: 1 }, { fr: 1 }]);
  expect(host.responsive.mobile?.columns).toEqual([{ fr: 1 }]);
  for (const field of binding.fields) {
    const input = tree.get(field.input_id)!.node, label = tree.get(field.label_id)!.node;
    expect(input.type).toBe('form.control'); expect(label.type).toBe('form.label');
    expect(input.locked).toBe(false); expect(label.locked).toBe(false);
    if (field.name !== 'privacy') {
      expect(input.style.width).toBe('fill'); expect(input.style.font_size).toEqual({ value: 16, unit: 'px' });
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        expect(input.style[`border_${side}`]).toEqual({ width: 1, style: 'solid', color: { kind: 'token', value: 'border' } });
      }
    }
    expect(input.props).not.toHaveProperty('value');
    expect(input.props).not.toHaveProperty('endpoint');
  }
  expect(tree.get(binding.submit_id)!.node.props).toEqual({ label: preset.props.submitLabel });
  const target = validateDocumentV3({ ...structuredClone(fixture), blocks: [] });
  let sequence = 0;
  const pasted = executeDocumentCommand(target, { kind: 'paste', clipboard: compositionClipboard(choice),
    destination: { parentId: null, index: 0 } }, () => uuid(++sequence)).document;
  const pastedTree = indexTree(pasted), pastedHost = [...pastedTree.values()].find(item => item.node.binding)!.node;
  const pastedBinding = pastedHost.binding!;
  expect([...pastedTree.keys()].every(id => !tree.has(id))).toBe(true);
  expect(pastedBinding.form_kind).toBe(binding.form_kind);
  for (const field of pastedBinding.fields) {
    expect(pastedTree.has(field.input_id)).toBe(true); expect(pastedTree.has(field.label_id)).toBe(true);
  }
  const input = pastedTree.get(pastedBinding.fields[0].input_id)!.node;
  const changed = executeDocumentCommand(pasted, { kind: 'transaction', commands: [
    { kind: 'content', id: input.instance_id, props: { ...input.props, placeholder: '새 안내 문구' } },
    { kind: 'style', id: input.instance_id, viewport: 'mobile', set: { height: { value: 56, unit: 'px' } } },
  ] }, () => uuid(++sequence)).document;
  expect(indexTree(changed).get(input.instance_id)!.node.props).toHaveProperty('placeholder', '새 안내 문구');
  expect(indexTree(changed).get(input.instance_id)!.node.responsive.mobile?.height).toEqual({ value: 56, unit: 'px' });
  expect(validateDocumentV3(JSON.parse(JSON.stringify(changed)))).toEqual(changed);
  expect(JSON.stringify(source)).toBe(before);
});
