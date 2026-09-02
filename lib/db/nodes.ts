import { randomUUID } from 'expo-crypto';
import { getDatabase } from './schema';
import { logEvent } from './activityLog';
import type { GraphNode, NodeStatus, NodeType } from './types';

interface NodeRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  status: string;
  tags: string;
  attributes: string;
  created_at: string;
  updated_at: string;
  embedding_id: string | null;
}

function rowToNode(row: NodeRow): GraphNode {
  return {
    id: row.id,
    type: row.type as NodeType,
    title: row.title,
    body: row.body,
    status: row.status as NodeStatus,
    tags: JSON.parse(row.tags),
    attributes: JSON.parse(row.attributes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    embeddingId: row.embedding_id,
  };
}

export interface CreateNodeInput {
  type: NodeType;
  title: string;
  body?: string | null;
  status?: NodeStatus;
  tags?: string[];
  attributes?: object;
}

export function createNode(input: CreateNodeInput): GraphNode {
  const db = getDatabase();
  const now = new Date().toISOString();
  const node: GraphNode = {
    id: randomUUID(),
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    status: input.status ?? 'active',
    tags: input.tags ?? [],
    attributes: (input.attributes ?? {}) as Record<string, unknown>,
    createdAt: now,
    updatedAt: now,
    embeddingId: null,
  };

  db.runSync(
    `INSERT INTO nodes (id, type, title, body, status, tags, attributes, created_at, updated_at, embedding_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      node.id,
      node.type,
      node.title,
      node.body,
      node.status,
      JSON.stringify(node.tags),
      JSON.stringify(node.attributes),
      node.createdAt,
      node.updatedAt,
      node.embeddingId,
    ],
  );

  logEvent({ type: 'node_created', nodeId: node.id });
  return node;
}

export interface UpdateNodeInput {
  title?: string;
  body?: string | null;
  status?: NodeStatus;
  tags?: string[];
  attributes?: object;
  embeddingId?: string | null;
}

export function updateNode(id: string, patch: UpdateNodeInput): GraphNode | null {
  const db = getDatabase();
  const existing = getNode(id);
  if (!existing) return null;

  const updated: GraphNode = {
    ...existing,
    ...patch,
    attributes: (patch.attributes ?? existing.attributes) as Record<string, unknown>,
    updatedAt: new Date().toISOString(),
  };

  db.runSync(
    `UPDATE nodes SET title = ?, body = ?, status = ?, tags = ?, attributes = ?, updated_at = ?, embedding_id = ?
     WHERE id = ?`,
    [
      updated.title,
      updated.body,
      updated.status,
      JSON.stringify(updated.tags),
      JSON.stringify(updated.attributes),
      updated.updatedAt,
      updated.embeddingId,
      id,
    ],
  );

  if (patch.status && patch.status !== existing.status) {
    logEvent({
      type: 'status_changed',
      nodeId: id,
      fromStatus: existing.status,
      toStatus: patch.status,
    });
  } else {
    logEvent({ type: 'node_updated', nodeId: id });
  }

  return updated;
}

export function getNode(id: string): GraphNode | null {
  const db = getDatabase();
  const row = db.getFirstSync<NodeRow>('SELECT * FROM nodes WHERE id = ?', [id]);
  return row ? rowToNode(row) : null;
}

export interface ListNodesFilter {
  type?: NodeType;
  types?: NodeType[];
  status?: NodeStatus;
}

export function listNodes(filter: ListNodesFilter = {}): GraphNode[] {
  const db = getDatabase();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (filter.type) {
    clauses.push('type = ?');
    params.push(filter.type);
  } else if (filter.types && filter.types.length > 0) {
    clauses.push(`type IN (${filter.types.map(() => '?').join(',')})`);
    params.push(...filter.types);
  }
  if (filter.status) {
    clauses.push('status = ?');
    params.push(filter.status);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.getAllSync<NodeRow>(
    `SELECT * FROM nodes ${where} ORDER BY updated_at DESC`,
    params,
  );
  return rows.map(rowToNode);
}

export function deleteNode(id: string): void {
  const db = getDatabase();
  db.runSync('DELETE FROM nodes WHERE id = ?', [id]);
}
