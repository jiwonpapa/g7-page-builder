import React, { useState } from 'react';
import type { Node } from '../../documents/v3/types';
import { effectiveStyle, type Viewport } from '../../documents/v3/validate';

export function LayerTree({ nodes, selected, select, viewport = 'base' }: { nodes: Node[]; selected: string[]; select: (id: string, extend?: boolean) => void; viewport?: Viewport }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  function rows(items: Node[], depth: number): React.ReactNode {
    return items.map(node => {
      const children = node.slots.content ?? [];
      const open = !collapsed.has(node.instance_id);
      return <li key={node.instance_id} role="treeitem" aria-selected={selected.includes(node.instance_id)}
        aria-expanded={children.length ? open : undefined} aria-label={node.name}>
        <div className="g7pb-v3-layer-row">
          {children.length > 0 && <button type="button" aria-label={`${node.name} ${open ? '접기' : '펼치기'}`}
            onClick={() => setCollapsed(previous => { const next = new Set(previous); if (open) next.add(node.instance_id); else next.delete(node.instance_id); return next; })}>{open ? '−' : '+'}</button>}
          <button type="button" data-testid={`layer-${node.instance_id}`} aria-pressed={selected.includes(node.instance_id)}
            onClick={event => select(node.instance_id, event.shiftKey)}
            title={node.name} style={{ flex: 1, textAlign: 'start', border: 0, padding: '6px 8px',
              background: selected.includes(node.instance_id) ? 'var(--g7pb-accent-soft)' : 'transparent', color: 'var(--g7pb-text)' }}>
            {node.name}{node.locked ? ' · 잠김' : ''}{effectiveStyle(node, viewport).hidden ? ' · 숨김' : ''}
          </button>
        </div>
        {children.length > 0 && open && <ul role="group" style={{ listStyle: 'none', margin: 0, paddingLeft: 14 }}>{rows(children, depth + 1)}</ul>}
      </li>;
    });
  }
  return <ul role="tree" aria-label="페이지 레이어" aria-multiselectable="true" style={{ listStyle: 'none', padding: 0, margin: 0 }}>{rows(nodes, 0)}</ul>;
}
