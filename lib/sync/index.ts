// Supabase sync — see plan's "Текущая задача: подключить Supabase". Push-then-pull,
// last-write-wins on `updated_at` for the mutable `nodes` table; `edges` and
// `activity_log` are append-only so pulling is just "insert if missing".
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { getNode, listNodesUpdatedSince, upsertNodeRaw } from '../db/nodes';
import { insertEdgeIfMissing, listEdgesCreatedSince } from '../db/edges';
import { insertEventIfMissing, listEventsCreatedSince } from '../db/activityLog';
import { getSyncWatermark, setSyncMeta } from '../db/syncMeta';
import type { ActivityEvent, GraphEdge, GraphNode } from '../db/types';

interface RemoteNodeRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  status: string;
  tags: unknown;
  attributes: unknown;
  created_at: string;
  updated_at: string;
}

interface RemoteEdgeRow {
  id: string;
  user_id: string;
  from_id: string;
  to_id: string;
  type: string;
  created_at: string;
  weight: number | null;
  note: string | null;
}

interface RemoteActivityRow {
  id: string;
  user_id: string;
  type: string;
  node_id: string | null;
  edge_id: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
  metadata: unknown;
}

// `embedding` is deliberately omitted — that column is owned by the `embed`
// Edge Function, and omitting the key from the upsert payload means Postgres
// leaves it untouched on conflict instead of nulling it out.
function toRemoteNode(node: GraphNode, userId: string): Omit<RemoteNodeRow, never> {
  return {
    id: node.id,
    user_id: userId,
    type: node.type,
    title: node.title,
    body: node.body,
    status: node.status,
    tags: node.tags,
    attributes: node.attributes,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
  };
}

function fromRemoteNode(row: RemoteNodeRow): GraphNode {
  return {
    id: row.id,
    type: row.type as GraphNode['type'],
    title: row.title,
    body: row.body,
    status: row.status as GraphNode['status'],
    tags: (row.tags as string[]) ?? [],
    attributes: (row.attributes as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    embeddingId: null,
  };
}

function toRemoteEdge(edge: GraphEdge, userId: string): RemoteEdgeRow {
  return {
    id: edge.id,
    user_id: userId,
    from_id: edge.fromId,
    to_id: edge.toId,
    type: edge.type,
    created_at: edge.createdAt,
    weight: edge.weight,
    note: edge.note,
  };
}

function fromRemoteEdge(row: RemoteEdgeRow): GraphEdge {
  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    type: row.type as GraphEdge['type'],
    createdAt: row.created_at,
    weight: row.weight,
    note: row.note,
  };
}

function toRemoteActivity(event: ActivityEvent, userId: string): RemoteActivityRow {
  return {
    id: event.id,
    user_id: userId,
    type: event.type,
    node_id: event.nodeId,
    edge_id: event.edgeId,
    from_status: event.fromStatus,
    to_status: event.toStatus,
    created_at: event.createdAt,
    metadata: event.metadata,
  };
}

function fromRemoteActivity(row: RemoteActivityRow): ActivityEvent {
  return {
    id: row.id,
    type: row.type as ActivityEvent['type'],
    nodeId: row.node_id,
    edgeId: row.edge_id,
    fromStatus: row.from_status as ActivityEvent['fromStatus'],
    toStatus: row.to_status as ActivityEvent['toStatus'],
    createdAt: row.created_at,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function maxIso(values: string[], fallback: string): string {
  return values.reduce((max, v) => (v > max ? v : max), fallback);
}

// Every function below takes the already-null-checked client explicitly
// (resolved once in syncNow) rather than closing over the nullable module
// export — keeps null-safety enforced by the type checker, not by convention.

async function pushNodes(client: SupabaseClient, userId: string): Promise<void> {
  const since = getSyncWatermark('nodes:pushed');
  const changed = listNodesUpdatedSince(since);
  if (changed.length === 0) return;

  const { error } = await client.from('nodes').upsert(changed.map((n) => toRemoteNode(n, userId)));
  if (error) throw new Error(`push nodes failed: ${error.message}`);

  setSyncMeta('nodes:pushed', maxIso(changed.map((n) => n.updatedAt), since));
}

async function pushEdges(client: SupabaseClient, userId: string): Promise<void> {
  const since = getSyncWatermark('edges:pushed');
  const changed = listEdgesCreatedSince(since);
  if (changed.length === 0) return;

  const { error } = await client
    .from('edges')
    .upsert(changed.map((e) => toRemoteEdge(e, userId)), { ignoreDuplicates: true });
  if (error) throw new Error(`push edges failed: ${error.message}`);

  setSyncMeta('edges:pushed', maxIso(changed.map((e) => e.createdAt), since));
}

async function pushActivityLog(client: SupabaseClient, userId: string): Promise<void> {
  const since = getSyncWatermark('activity_log:pushed');
  const changed = listEventsCreatedSince(since);
  if (changed.length === 0) return;

  const { error } = await client
    .from('activity_log')
    .upsert(changed.map((e) => toRemoteActivity(e, userId)), { ignoreDuplicates: true });
  if (error) throw new Error(`push activity_log failed: ${error.message}`);

  setSyncMeta('activity_log:pushed', maxIso(changed.map((e) => e.createdAt), since));
}

async function pullNodes(client: SupabaseClient, userId: string): Promise<void> {
  const since = getSyncWatermark('nodes:pulled');
  const { data, error } = await client
    .from('nodes')
    .select('id, user_id, type, title, body, status, tags, attributes, created_at, updated_at')
    .eq('user_id', userId)
    .gt('updated_at', since);
  if (error) throw new Error(`pull nodes failed: ${error.message}`);

  const rows = (data ?? []) as RemoteNodeRow[];
  for (const row of rows) {
    const remote = fromRemoteNode(row);
    const local = getNode(remote.id);
    // Real last-write-wins: only accept the remote row if it's actually newer
    // than what's on-device — a blind upsert would let a stale pull clobber
    // an unsynced local edit.
    if (!local || remote.updatedAt > local.updatedAt) {
      upsertNodeRaw(remote);
    }
  }

  if (rows.length > 0) {
    setSyncMeta('nodes:pulled', maxIso(rows.map((r) => r.updated_at), since));
  }
}

async function pullEdges(client: SupabaseClient, userId: string): Promise<void> {
  const since = getSyncWatermark('edges:pulled');
  const { data, error } = await client
    .from('edges')
    .select('id, user_id, from_id, to_id, type, created_at, weight, note')
    .eq('user_id', userId)
    .gt('created_at', since);
  if (error) throw new Error(`pull edges failed: ${error.message}`);

  const rows = (data ?? []) as RemoteEdgeRow[];
  for (const row of rows) {
    insertEdgeIfMissing(fromRemoteEdge(row));
  }
  if (rows.length > 0) {
    setSyncMeta('edges:pulled', maxIso(rows.map((r) => r.created_at), since));
  }
}

async function pullActivityLog(client: SupabaseClient, userId: string): Promise<void> {
  const since = getSyncWatermark('activity_log:pulled');
  const { data, error } = await client
    .from('activity_log')
    .select('id, user_id, type, node_id, edge_id, from_status, to_status, created_at, metadata')
    .eq('user_id', userId)
    .gt('created_at', since);
  if (error) throw new Error(`pull activity_log failed: ${error.message}`);

  const rows = (data ?? []) as RemoteActivityRow[];
  for (const row of rows) {
    insertEventIfMissing(fromRemoteActivity(row));
  }
  if (rows.length > 0) {
    setSyncMeta('activity_log:pulled', maxIso(rows.map((r) => r.created_at), since));
  }
}

export async function pushLocalChanges(client: SupabaseClient, userId: string): Promise<void> {
  await pushNodes(client, userId);
  await pushEdges(client, userId);
  await pushActivityLog(client, userId);
}

export async function pullRemoteChanges(client: SupabaseClient, userId: string): Promise<void> {
  await pullNodes(client, userId);
  await pullEdges(client, userId);
  await pullActivityLog(client, userId);
}

/** Push-then-pull so the device's own latest edits always win over stale remote data. */
export async function syncNow(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase не настроен — заполни .env (см. .env.example)');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');

  await pushLocalChanges(supabase, session.user.id);
  await pullRemoteChanges(supabase, session.user.id);
}
