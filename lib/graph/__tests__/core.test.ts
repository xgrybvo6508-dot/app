import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findNeighbors,
  findNodesMissingEdgeType,
  findStaleNodes,
  getPartOfChain,
  summarizeGraph,
} from '../core';
import type { GraphEdge, GraphNode } from '../../db/types';

function makeNode(partial: Partial<GraphNode> & Pick<GraphNode, 'id' | 'type'>): GraphNode {
  return {
    title: partial.id,
    body: null,
    status: 'active',
    tags: [],
    attributes: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    embeddingId: null,
    ...partial,
  };
}

function makeEdge(partial: Partial<GraphEdge> & Pick<GraphEdge, 'fromId' | 'toId' | 'type'>): GraphEdge {
  return {
    id: `${partial.fromId}->${partial.toId}`,
    createdAt: '2024-01-01T00:00:00.000Z',
    weight: null,
    note: null,
    ...partial,
  };
}

test('findNeighbors finds 1-hop and 2-hop nodes', () => {
  const nodes = [
    makeNode({ id: 'a', type: 'idea' }),
    makeNode({ id: 'b', type: 'idea' }),
    makeNode({ id: 'c', type: 'idea' }),
  ];
  const edges = [
    makeEdge({ fromId: 'a', toId: 'b', type: 'derived_from' }),
    makeEdge({ fromId: 'b', toId: 'c', type: 'derived_from' }),
  ];

  const oneHop = findNeighbors('a', nodes, edges, 1);
  assert.deepEqual(oneHop.map((r) => r.node.id), ['b']);

  const twoHop = findNeighbors('a', nodes, edges, 2);
  assert.deepEqual(
    twoHop.map((r) => r.node.id).sort(),
    ['b', 'c'],
  );
});

test('getPartOfChain walks task -> plan_item -> goal', () => {
  const nodes = [
    makeNode({ id: 'task-1', type: 'task' }),
    makeNode({ id: 'milestone-1', type: 'plan_item' }),
    makeNode({ id: 'goal-1', type: 'plan_item' }),
  ];
  const edges = [
    makeEdge({ fromId: 'task-1', toId: 'milestone-1', type: 'part_of' }),
    makeEdge({ fromId: 'milestone-1', toId: 'goal-1', type: 'part_of' }),
  ];

  const chain = getPartOfChain('task-1', nodes, edges);
  assert.deepEqual(
    chain.map((c) => c.node.id),
    ['task-1', 'milestone-1', 'goal-1'],
  );
});

test('findNodesMissingEdgeType flags knowledge_item nodes without applies_to', () => {
  const nodes = [
    makeNode({ id: 'k1', type: 'knowledge_item' }),
    makeNode({ id: 'k2', type: 'knowledge_item' }),
  ];
  const edges = [makeEdge({ fromId: 'k1', toId: 'task-1', type: 'applies_to' })];

  const missing = findNodesMissingEdgeType(nodes, edges, 'applies_to');
  assert.deepEqual(missing.map((n) => n.id), ['k2']);
});

test('findStaleNodes only flags active nodes past the threshold', () => {
  const now = new Date('2024-02-01T00:00:00.000Z');
  const nodes = [
    makeNode({ id: 'stale', type: 'idea', status: 'active', updatedAt: '2024-01-01T00:00:00.000Z' }),
    makeNode({ id: 'fresh', type: 'idea', status: 'active', updatedAt: '2024-01-31T00:00:00.000Z' }),
    makeNode({ id: 'done', type: 'idea', status: 'done', updatedAt: '2024-01-01T00:00:00.000Z' }),
  ];
  const thresholdMs = 14 * 24 * 60 * 60 * 1000;
  const stale = findStaleNodes(nodes, thresholdMs, now);
  assert.deepEqual(stale.map((n) => n.id), ['stale']);
});

test('summarizeGraph counts nodes by type and status', () => {
  const nodes = [
    makeNode({ id: 'a', type: 'idea', status: 'active' }),
    makeNode({ id: 'b', type: 'idea', status: 'done' }),
    makeNode({ id: 'c', type: 'note', status: 'active' }),
  ];
  const summary = summarizeGraph(nodes);
  assert.equal(summary.total, 3);
  assert.equal(summary.byType.idea, 2);
  assert.equal(summary.byStatus.active, 2);
});
