import policy from '../../../../schemas/design-policy-v3.json';
import type { DataConnection, DocumentV3, Node } from './types';
import { reject } from './schema';
import { remapDataControls, validateDataControls } from './dataControls';

/** Authored element trees are templates; public capability inputs never contain live records. */
export function validateDataConnections(document: DocumentV3): void {
  function visit(nodes: Node[], inside: boolean): void {
    for (const node of nodes) {
      if (inside && (node.data || node.binding || node.system || node.behavior || node.type.startsWith('form.'))) reject('data_owner', node.instance_id);
      const data = node.data;
      if (data) {
        if (!policy.data.host_types.includes(node.type) || !('tag' in node.props) || !policy.data.host_tags.includes(node.props.tag)
          || node.binding || node.system || node.behavior || node.slots.content?.length !== 1) reject('data_host', node.instance_id);
        if (!policy.data.feeds[data.source].includes(data.feed)) reject('data_feed', node.instance_id);
        if ((data.feed === 'board' || data.source === 'post-detail') && !data.board_slug) reject('data_source', node.instance_id);
        if (data.source === 'product-detail' && !data.product_key) reject('data_source', node.instance_id);
        const children = new Map<string, Node>();
        const collect = (items: Node[]): void => { for (const child of items) { children.set(child.instance_id, child); collect(child.slots.content ?? []); } };
        collect(node.slots.content ?? []);
        const keys = new Set<string>();
        for (const field of data.fields) {
          const target = children.get(field.node_id), key = field.node_id + ':' + field.property;
          if (!target || keys.has(key)) reject('data_reference', field.node_id);
          keys.add(key);
          if (!policy.data.properties[field.property].includes(target.type) || !policy.data.fields[field.property].includes(field.field)) reject('data_field', field.node_id);
        }
      }
      visit(node.slots.content ?? [], inside || Boolean(data));
    }
  }
  visit(document.blocks, false);
  validateDataControls(document);
}
export function remapData(data: DataConnection, ids: ReadonlyMap<string, string>): DataConnection {
  return { ...data, ...(data.controls ? { controls: remapDataControls(data.controls, ids) } : {}),
    fields: data.fields.map(field => ({ ...field, node_id: ids.get(field.node_id) ?? reject('data_clipboard', field.node_id) })) };
}
