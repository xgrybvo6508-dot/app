import { randomUUID } from 'expo-crypto';
import { getDatabase } from './schema';
import type { ActivityEvent, ActivityEventType, NodeStatus } from './types';

interface ActivityLogRow {
  id: string;
  type: string;
  node_id: string | null;
  edge_id: string | null;
  from_status: string | null;
  to_status: string | null;
  created_at: string;
  metadata: string;
}

function rowToEvent(row: ActivityLogRow): ActivityEvent {
  return {
    id: row.id,
    type: row.type as ActivityEventType,
    nodeId: row.node_id,
    edgeId: row.edge_id,
    fromStatus: row.from_status as NodeStatus | null,
    toStatus: row.to_status as NodeStatus | null,
    createdAt: row.created_at,
    metadata: JSON.parse(row.metadata),
  };
}

export interface LogEventInput {
  type: ActivityEventType;
  nodeId?: string;
  edgeId?: string;
  fromStatus?: NodeStatus;
  toStatus?: NodeStatus;
  metadata?: Record<string, unknown>;
}

// The insight engine (Energy Index, funnel conversion, stale detection) is computed
// from this append-only log, not from current node state — see plan's "Insight-движок".
export function logEvent(input: LogEventInput): ActivityEvent {
  const db = getDatabase();
  const event: ActivityEvent = {
    id: randomUUID(),
    type: input.type,
    nodeId: input.nodeId ?? null,
    edgeId: input.edgeId ?? null,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus ?? null,
    createdAt: new Date().toISOString(),
    metadata: input.metadata ?? {},
  };

  db.runSync(
    `INSERT INTO activity_log (id, type, node_id, edge_id, from_status, to_status, created_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      event.type,
      event.nodeId,
      event.edgeId,
      event.fromStatus,
      event.toStatus,
      event.createdAt,
      JSON.stringify(event.metadata),
    ],
  );

  return event;
}

export function listEventsSince(sinceIso: string): ActivityEvent[] {
  const db = getDatabase();
  const rows = db.getAllSync<ActivityLogRow>(
    'SELECT * FROM activity_log WHERE created_at >= ? ORDER BY created_at ASC',
    [sinceIso],
  );
  return rows.map(rowToEvent);
}
