// Thin DB-backed wrappers around the pure algorithms in ./core — this is what
// screens/chat actually call.
import { listNodes } from '../db/nodes';
import { listAllEdges } from '../db/edges';
import type { EdgeType, GraphNode, NodeType } from '../db/types';
import {
  findNeighbors,
  findNodesMissingEdgeType,
  findStaleNodes,
  getPartOfChain,
  summarizeGraph,
  type NeighborResult,
  type PartOfChainLink,
} from './core';

// One query for the whole edges table beats N per-node getOutgoingEdges/
// getIncomingEdges round-trips — these helpers are called per-visible-node
// (e.g. once per Kanban card) so the per-call cost matters.
export function getNeighborsInGraph(rootId: string, maxHops = 1): NeighborResult[] {
  const nodes = listNodes();
  const edges = listAllEdges();
  return findNeighbors(rootId, nodes, edges, maxHops);
}

export function getPartOfChainInGraph(startId: string): PartOfChainLink[] {
  const nodes = listNodes();
  const edges = listAllEdges();
  return getPartOfChain(startId, nodes, edges);
}

export function findNodesMissingEdgeTypeInGraph(
  candidateType: NodeType,
  edgeType: EdgeType,
): GraphNode[] {
  const candidates = listNodes({ type: candidateType });
  const edges = listAllEdges();
  return findNodesMissingEdgeType(candidates, edges, edgeType);
}

export function findStaleNodesInGraph(thresholdMs: number): GraphNode[] {
  return findStaleNodes(listNodes({ status: 'active' }), thresholdMs);
}

export function getGraphSnapshot() {
  return summarizeGraph(listNodes());
}

export {
  decomposeNode,
  type DecomposeInput,
} from './decompose';
