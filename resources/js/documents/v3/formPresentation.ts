import policy from '../../../../schemas/design-policy-v3.json';
import type { DocumentV3 } from './types';
import type { Viewport } from './validate';
import { behaviorPresentation, type BehaviorAttributes } from './behaviorPresentation';
import { indexTree, nodeAnchor } from './tree';

/** Generated roles and constraints come from the fixed service policy, not authored HTML. */
export function formPresentation(document: DocumentV3, viewport: Viewport = 'base') {
  const projection = behaviorPresentation(document, viewport), formAttributes = new Map<string, BehaviorAttributes>();
  for (const { node } of indexTree(document).values()) {
    const style = projection.styles.get(node.instance_id)!;
    if (node.type === 'form.control') {
      for (const key of ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color']) style[key] ??= 'inherit';
    }
    if (node.type === 'form.label') style['white-space'] = 'pre-wrap';
    if (!node.binding) continue;
    for (const field of node.binding.fields) {
      const rule = policy.bindings.fields[field.name];
      formAttributes.set(field.label_id, { for: nodeAnchor(field.input_id) });
      formAttributes.set(field.input_id, { name: field.name, 'aria-labelledby': nodeAnchor(field.label_id),
        ...(rule.required ? { required: '' } : {}),
        ...('max_length' in rule ? { maxlength: String(rule.max_length) } : {}),
        ...('autocomplete' in rule ? { autocomplete: rule.autocomplete } : {}),
        ...(rule.kind === 'checkbox' ? { value: '1' } : {}) });
    }
    formAttributes.set(node.binding.submit_id, { 'data-g7pb-form-submit': '' });
    formAttributes.set(node.binding.status_id, { 'data-g7pb-form-status': '', role: 'status', 'aria-live': 'polite' });
  }
  for (const [id, attrs] of formAttributes) projection.attributes.set(id, { ...projection.attributes.get(id), ...attrs });
  return { ...projection, formAttributes };
}
