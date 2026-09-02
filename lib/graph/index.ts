// Thin DB-backed wrappers around the pure algorithms in ./core — this is what
// screens/chat actually call.
import { listNodes } from '../db/nodes';
import { createEdge, getIncomingEdges, getOutgoingEdges } from '../db/edges';
import type { EdgeType, GraphEdge, GraphNode, NodeType } from '../db/types';
import {
  findNeighbors,
  findNodesMissingEdgeType,
  findStaleNodes,
  getPartOfChain,
  summarizeGraph,
  type NeighborResult,
  type PartOfChainLink,
} from './core';

function allEdgesForNodes(nodes: GraphNode[]): GraphEdge[] {
  const seen = new Map<string, GraphEdge>();
  for (const node of nodes) {
    for (const edge of [...getOutgoingEdges(node.id), ...getIncomingEdges(node.id)]) {
      seen.set(edge.id, edge);
    }
  }
  return Array.from(seen.values());
}

export function getNeighborsInGraph(rootId: string, maxHops = 1): NeighborResult[] {
  const nodes = listNodes();
  const edges = allEdgesForNodes(nodes);
  return findNeighbors(rootId, nodes, edges, maxHops);
}

export function getPartOfChainInGraph(startId: string): PartOfChainLink[] {
  const nodes = listNodes();
  const edges = allEdgesForNodes(nodes);
  return getPartOfChain(startId, nodes, edges);
}

export function findNodesMissingEdgeTypeInGraph(
  candidateType: NodeType,
  edgeType: EdgeType,
): GraphNode[] {
  const candidates = listNodes({ type: candidateType });
  const edges = allEdgesForNodes(candidates);
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
