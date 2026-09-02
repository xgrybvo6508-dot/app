// Pure graph algorithms — take plain nodes/edges arrays, no DB access, no React.
// Kept separate from lib/db so they're trivially unit-testable (see plan's
// verification step: "unit-тесты на чистые функции").
import type { EdgeType, GraphEdge, GraphNode } from '../db/types';

export interface NeighborResult {
  node: GraphNode;
  distance: number;
  viaEdge: GraphEdge;
}

/**
 * BFS outward from `rootId` following edges in either direction, up to `maxHops`.
 * Powers the canvas "focus mode" (dim everything outside 1-2 hops).
 */
export function findNeighbors(
  rootId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxHops = 1,
): NeighborResult[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>([rootId]);
  const result: NeighborResult[] = [];
  let frontier = [rootId];

  for (let hop = 1; hop <= maxHops && frontier.length > 0; hop++) {
    const nextFrontier: string[] = [];
    for (const currentId of frontier) {
      for (const edge of edges) {
        const neighborId =
          edge.fromId === currentId ? edge.toId : edge.toId === currentId ? edge.fromId : null;
        if (!neighborId || visited.has(neighborId)) continue;
        const neighborNode = nodeById.get(neighborId);
        if (!neighborNode) continue;
        visited.add(neighborId);
        result.push({ node: neighborNode, distance: hop, viaEdge: edge });
        nextFrontier.push(neighborId);
      }
    }
    frontier = nextFrontier;
  }

  return result;
}

export interface PartOfChainLink {
  node: GraphNode;
}

/**
 * Walks `part_of` edges upward from a task/plan_item to build the
 * "Задача → Веха → Цель" breadcrumb from the plan's UX section.
 * Returns the chain starting at `startId` (excluded... actually included) up to the root.
 */
export function getPartOfChain(
  startId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  maxDepth = 10,
): PartOfChainLink[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const chain: PartOfChainLink[] = [];
  let currentId: string | undefined = startId;
  const seen = new Set<string>();

  for (let i = 0; i < maxDepth && currentId && !seen.has(currentId); i++) {
    seen.add(currentId);
    const node = nodeById.get(currentId);
    if (!node) break;
    chain.push({ node });

    const parentEdge = edges.find((e) => e.fromId === currentId && e.type === 'part_of');
    currentId = parentEdge?.toId;
  }

  return chain;
}

/**
 * Finds nodes with no outgoing edge of the given type — e.g. `knowledge_item`
 * nodes missing `applies_to` ("выучено, но не применено") or `research_finding`
 * nodes missing a link to a task/goal.
 */
export function findNodesMissingEdgeType(
  candidateNodes: GraphNode[],
  edges: GraphEdge[],
  edgeType: EdgeType,
): GraphNode[] {
  const hasEdge = new Set(edges.filter((e) => e.type === edgeType).map((e) => e.fromId));
  return candidateNodes.filter((n) => !hasEdge.has(n.id));
}

/**
 * Nodes whose status is 'active' but haven't been touched in longer than
 * `thresholdMs` — the "stuck" detector referenced throughout the insight engine.
 */
export function findStaleNodes(
  nodes: GraphNode[],
  thresholdMs: number,
  now: Date = new Date(),
): GraphNode[] {
  return nodes.filter((n) => {
    if (n.status !== 'active') return false;
    const age = now.getTime() - new Date(n.updatedAt).getTime();
    return age > thresholdMs;
  });
}

/** Counts of nodes by type and by status — the cheap "graph snapshot" for chat context. */
export function summarizeGraph(nodes: GraphNode[]): {
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
} {
  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const n of nodes) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
    byStatus[n.status] = (byStatus[n.status] ?? 0) + 1;
  }
  return { byType, byStatus, total: nodes.length };
}
