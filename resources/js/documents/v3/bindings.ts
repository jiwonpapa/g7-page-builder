import policy from '../../../../schemas/design-policy-v3.json';
import type { DocumentV3, Node, ServiceBinding } from './types';
import { reject } from './schema';

/** Fixed capability grammar. The editor owns layout; adapters own submission and live values. */
export function validateBindings(document: DocumentV3): void {
  // Validation cannot import the command-side tree helpers, which themselves validate.
  const tree = new Map<string, { node: Node; ancestors: Node[] }>(), rules = policy.bindings, triggers = new Set<string>();
  function visit(nodes: Node[], ancestors: Node[]): void {
    for (const node of nodes) {
      tree.set(node.instance_id, { node, ancestors });
      visit(node.slots.content ?? [], [...ancestors, node]);
    }
  }
  visit(document.blocks, []);
  for (const { node } of tree.values()) {
    const behavior = node.behavior;
    if (!behavior) continue;
    if (behavior.kind === 'carousel') {
      for (const id of [behavior.previous_id, behavior.next_id, behavior.rotation_id]) if (id) triggers.add(id);
    } else for (const pair of behavior.pairs) triggers.add(pair.trigger_id);
  }
  for (const { node: host, ancestors } of tree.values()) {
    const binding = host.binding;
    if (!binding) continue;
    if (!rules.host_types.includes(host.type) || !('tag' in host.props) || !rules.host_tags.includes(host.props.tag)) reject('binding_host', host.instance_id);
    if (host.behavior || ancestors.some(node => node.binding)) reject('binding_owner', host.instance_id);
    const used = new Set<string>(), names = new Set<string>();
    const target = (id: string, type: Node['type']): Node => {
      const item = tree.get(id);
      if (!item || !item.ancestors.includes(host)) reject('binding_reference', id);
      if (used.has(id)) reject('binding_duplicate', id);
      used.add(id);
      if (item.node.type !== type) reject('binding_role', id);
      return item.node;
    };
    for (const field of binding.fields) {
      if (names.has(field.name)) reject('binding_duplicate', host.instance_id);
      names.add(field.name);
      const input = target(field.input_id, 'form.control');
      target(field.label_id, 'form.label');
      if (input.type !== 'form.control' || input.props.kind !== rules.fields[field.name].kind) reject('binding_control', field.input_id);
    }
    for (const [name, rule] of Object.entries(rules.fields)) if (rule.required && !names.has(name)) reject('binding_required', host.instance_id);
    target(binding.submit_id, 'action.button');
    target(binding.status_id, 'content.text');
    if (triggers.has(binding.submit_id)) reject('binding_action', binding.submit_id);
  }
}

/** Copy a complete connected subtree with new identities or reject atomically. */
export function remapBinding(binding: ServiceBinding, ids: ReadonlyMap<string, string>): ServiceBinding {
  const remap = (id: string) => ids.get(id) ?? reject('binding_clipboard', id);
  return { ...binding, submit_id: remap(binding.submit_id), status_id: remap(binding.status_id),
    fields: binding.fields.map(field => ({ ...field, input_id: remap(field.input_id), label_id: remap(field.label_id) })) };
}
