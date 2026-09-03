export type NodeType =
  | 'note'
  | 'idea'
  | 'task'
  | 'plan_item'
  | 'knowledge_item'
  | 'research_finding'
  | 'life_domain';

// 'active' = todo (default), 'in_progress' = actively worked, 'stuck' = insight-flagged
// stale, 'done' = complete, 'archived' = hidden. Kanban (module 5) maps its three
// columns onto active/in_progress/done.
export type NodeStatus = 'active' | 'in_progress' | 'stuck' | 'done' | 'archived';

export type EdgeType =
  | 'derived_from'
  | 'supports'
  | 'contradicts'
  | 'part_of'
  | 'blocks'
  | 'applies_to'
  | 'learned_for';

export interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  body: string | null;
  status: NodeStatus;
  tags: string[];
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  embeddingId: string | null;
}

export interface GraphEdge {
  id: string;
  fromId: string;
  toId: string;
  type: EdgeType;
  createdAt: string;
  weight: number | null;
  note: string | null;
}

export type ActivityEventType =
  | 'node_created'
  | 'node_updated'
  | 'status_changed'
  | 'edge_created'
  | 'review_completed'
  | 'chat_message_sent';

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  nodeId: string | null;
  edgeId: string | null;
  fromStatus: NodeStatus | null;
  toStatus: NodeStatus | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

// Type-specific `attributes` shapes — informational, stored as JSON on GraphNode.attributes.
export interface TaskAttributes {
  dueDate?: string;
  energyRequired?: 'low' | 'med' | 'high';
  completedAt?: string;
}

export interface KnowledgeItemAttributes {
  source?: string;
  masteryLevel?: number;
  reviewDueAt?: string;
  reviewIntervalDays?: number;
  easeFactor?: number;
  reviewCount?: number;
  learningPath?: 'simple' | 'complex';
  curiosityOnly?: boolean;
}

export interface ResearchFindingAttributes {
  sourceUrl?: string;
  credibilityNote?: string;
  sourceKind?: 'primary' | 'secondary' | 'opinion';
}

export interface IdeaAttributes {
  maturity?: 'raw' | 'developing' | 'validated';
}

export interface PlanItemAttributes {
  parentGoalId?: string;
  targetDate?: string;
}
