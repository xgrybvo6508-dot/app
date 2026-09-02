import type { GraphEdge, GraphNode } from '../db/types';

const TYPE_COLORS: Record<string, string> = {
  note: '#9aa0a6',
  idea: '#4c8bf5',
  knowledge_item: '#34a853',
  research_finding: '#a142f4',
  life_domain: '#fbbc04',
  task: '#ea4335',
  plan_item: '#ff6d01',
};

export interface CytoscapeElement {
  data: Record<string, string>;
}

/** Converts local graph nodes/edges into Cytoscape.js `elements` — consumed by
 * the WebView canvas in app/(tabs)/map.tsx. Node/edge shape stays the same
 * regardless of which node types are being viewed (карта / идеи / карта знаний
 * are all just filtered projections, per the plan). */
export function toCytoscapeElements(nodes: GraphNode[], edges: GraphEdge[]): CytoscapeElement[] {
  const nodeElements: CytoscapeElement[] = nodes.map((n) => ({
    data: {
      id: n.id,
      label: n.title,
      color: TYPE_COLORS[n.type] ?? '#888',
    },
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edgeElements: CytoscapeElement[] = edges
    .filter((e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId))
    .map((e) => ({
      data: {
        id: e.id,
        source: e.fromId,
        target: e.toId,
        label: e.type,
      },
    }));

  return [...nodeElements, ...edgeElements];
}
