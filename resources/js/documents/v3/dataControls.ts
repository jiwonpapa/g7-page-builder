import policy from '../../../../schemas/design-policy-v3.json';
import type { DataControls, DataControlRole, DocumentV3, Node } from './types';
import { reject } from './schema';

interface Entry { node: Node; ancestors: Node[] }
export const dataControlRoles = Object.keys(policy.data.control_roles) as DataControlRole[];
function entries(document: DocumentV3): Map<string, Entry> {
  const result = new Map<string, Entry>();
  function visit(nodes: Node[], ancestors: Node[]): void {
    for (const node of nodes) { result.set(node.instance_id, { node, ancestors }); visit(node.slots.content ?? [], [...ancestors, node]); }
  }
  visit(document.blocks, []);
  return result;
}
function candidate(entry: Entry, role: DataControlRole): boolean {
  const { node, ancestors } = entry;
  return policy.data.control_roles[role].includes(node.type)
    && (node.type !== 'form.control' || policy.data.control_kinds.includes(node.props.kind))
    && ![...ancestors, node].some(item => item.data || item.binding || item.system || item.behavior);
}
/** Existing authored elements, never generated per-block editors or live option data. */
export function dataControlCandidates(document: DocumentV3, role: DataControlRole): Node[] {
  return [...entries(document).values()].filter(entry => candidate(entry, role)).map(entry => entry.node);
}
export function validateDataControls(document: DocumentV3): void {
  const tree = entries(document), used = new Set<string>();
  for (const { node: host } of tree.values()) {
    const data = host.data, controls = data?.controls;
    if (!data || !controls) continue;
    const roles = dataControlRoles.filter(role => controls[role] !== undefined);
    const paging = [controls.previous_id, controls.next_id, controls.status_id];
    if (data.source.endsWith('-detail') || !roles.length || (paging.some(Boolean) && !paging.every(Boolean))) reject('data_controls', host.instance_id);
    for (const role of roles) {
      const id = controls[role];
      if (!id) reject('data_control_reference', host.instance_id);
      const entry = tree.get(id);
      if (!entry) reject('data_control_reference', id);
      if (!candidate(entry, role)) reject('data_control_owner', id);
      if (used.has(id)) reject('data_control_duplicate', id);
      used.add(id);
    }
  }
}
export function remapDataControls(controls: DataControls, ids: ReadonlyMap<string, string>): DataControls {
  const result = { ...controls };
  for (const role of dataControlRoles) {
    const id = controls[role];
    if (id) result[role] = ids.get(id) ?? reject('data_clipboard', id);
  }
  return result;
}
