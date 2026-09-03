import { randomUUID } from 'expo-crypto';
import { getDatabase } from './schema';
import { logEvent } from './activityLog';
import type { EdgeType, GraphEdge } from './types';

interface EdgeRow {
  id: string;
  from_id: string;
  to_id: string;
  type: string;
  created_at: string;
  weight: number | null;
  note: string | null;
}

function rowToEdge(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    type: row.type as EdgeType,
    createdAt: row.created_at,
    weight: row.weight,
    note: row.note,
  };
}

export interface CreateEdgeInput {
  fromId: string;
  toId: string;
  type: EdgeType;
  weight?: number;
  note?: string;
}

export function createEdge(input: CreateEdgeInput): GraphEdge {
  const db = getDatabase();
  const edge: GraphEdge = {
    id: randomUUID(),
    fromId: input.fromId,
    toId: input.toId,
    type: input.type,
    createdAt: new Date().toISOString(),
    weight: input.weight ?? null,
    note: input.note ?? null,
  };

  db.runSync(
    `INSERT INTO edges (id, from_id, to_id, type, created_at, weight, note) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [edge.id, edge.fromId, edge.toId, edge.type, edge.createdAt, edge.weight, edge.note],
  );

  logEvent({ type: 'edge_created', edgeId: edge.id, nodeId: edge.fromId });
  return edge;
}

export function getOutgoingEdges(nodeId: string, type?: EdgeType): GraphEdge[] {
  const db = getDatabase();
  const rows = type
    ? db.getAllSync<EdgeRow>('SELECT * FROM edges WHERE from_id = ? AND type = ?', [nodeId, type])
    : db.getAllSync<EdgeRow>('SELECT * FROM edges WHERE from_id = ?', [nodeId]);
  return rows.map(rowToEdge);
}

export function getIncomingEdges(nodeId: string, type?: EdgeType): GraphEdge[] {
  const db = getDatabase();
  const rows = type
    ? db.getAllSync<EdgeRow>('SELECT * FROM edges WHERE to_id = ? AND type = ?', [nodeId, type])
    : db.getAllSync<EdgeRow>('SELECT * FROM edges WHERE to_id = ?', [nodeId]);
  return rows.map(rowToEdge);
}

export function listAllEdges(): GraphEdge[] {
  const db = getDatabase();
  const rows = db.getAllSync<EdgeRow>('SELECT * FROM edges');
  return rows.map(rowToEdge);
}

export function deleteEdge(id: string): void {
  const db = getDatabase();
  db.runSync('DELETE FROM edges WHERE id = ?', [id]);
}

// --- sync helpers (see lib/sync) ---

export function listEdgesCreatedSince(sinceIso: string): GraphEdge[] {
  const db = getDatabase();
  const rows = db.getAllSync<EdgeRow>('SELECT * FROM edges WHERE created_at > ?', [sinceIso]);
  return rows.map(rowToEdge);
}

/** Edges are immutable once created, so pulling just needs "insert if missing". */
export function insertEdgeIfMissing(edge: GraphEdge): void {
  const db = getDatabase();
  db.runSync(
    `INSERT OR IGNORE INTO edges (id, from_id, to_id, type, created_at, weight, note) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [edge.id, edge.fromId, edge.toId, edge.type, edge.createdAt, edge.weight, edge.note],
  );
}
