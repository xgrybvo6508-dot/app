// Adaptive stale threshold — "2x медианного времени обновления для этого типа узла
// у ЭТОГО пользователя", not a fixed "14 days for everyone" (plan's guardrail).
import type { GraphNode } from '../db/types';
import { findStaleNodes } from '../graph/core';

function medianUpdateGapMs(nodes: GraphNode[], now: Date): number | null {
  if (nodes.length === 0) return null;
  const gaps = nodes
    .map((n) => now.getTime() - new Date(n.updatedAt).getTime())
    .sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
}

const FALLBACK_THRESHOLD_MS = 14 * 24 * 60 * 60 * 1000; // used only when there's no history yet

export function computeAdaptiveStaleNodes(
  nodesOfType: GraphNode[],
  now: Date = new Date(),
): GraphNode[] {
  const median = medianUpdateGapMs(nodesOfType, now);
  const threshold = median !== null ? median * 2 : FALLBACK_THRESHOLD_MS;
  return findStaleNodes(nodesOfType, threshold, now);
}
