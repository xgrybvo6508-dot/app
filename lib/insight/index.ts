import { listNodes } from '../db/nodes';
import { getOutgoingEdges } from '../db/edges';
import { listEventsSince } from '../db/activityLog';
import {
  computeCadenceScore,
  computeCompletionVelocity,
  computeEnergyIndex,
  computeStreakDays,
  countStatusRegressions,
} from './energyIndex';
import { computeFunnelRates, excludeCuriosityOnly, type FunnelCounts } from './funnel';
import { computeAdaptiveStaleNodes } from './staleDetection';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface WeeklyDigest {
  energyIndex: number;
  funnel: ReturnType<typeof computeFunnelRates>;
  staleNodeTitles: string[];
}

/** Ties the pure metric functions to real local data — this is what the weekly
 * digest / on-demand "как я вообще" chat query calls. */
export function computeWeeklyDigest(now: Date = new Date()): WeeklyDigest {
  const events = listEventsSince(new Date(now.getTime() - THIRTY_DAYS_MS).toISOString());

  const energyIndex = computeEnergyIndex({
    cadenceRatio: computeCadenceScore(events, now).ratio,
    completionVelocity: computeCompletionVelocity(events, 7, now),
    statusRegressions: countStatusRegressions(events, 7, now),
    streakDays: computeStreakDays(events, now),
  });

  const ideas = excludeCuriosityOnly(listNodes({ type: 'idea' }));
  const tasks = listNodes({ type: 'task' });
  const knowledgeItems = excludeCuriosityOnly(listNodes({ type: 'knowledge_item' }));
  const researchFindings = excludeCuriosityOnly(listNodes({ type: 'research_finding' }));

  const counts: FunnelCounts = {
    ideasTotal: ideas.length,
    ideasLinkedToTask: ideas.filter((i) => getOutgoingEdges(i.id, 'part_of').length > 0).length,
    tasksTotal: tasks.length,
    tasksDone: tasks.filter((t) => t.status === 'done').length,
    knowledgeItemsTotal: knowledgeItems.length,
    knowledgeItemsApplied: knowledgeItems.filter(
      (k) => getOutgoingEdges(k.id, 'applies_to').length > 0,
    ).length,
    researchFindingsTotal: researchFindings.length,
    researchFindingsUtilized: researchFindings.filter(
      (r) => getOutgoingEdges(r.id, 'applies_to').length > 0,
    ).length,
  };

  const staleNodes = [
    ...computeAdaptiveStaleNodes(listNodes({ type: 'idea', status: 'active' }), now),
    ...computeAdaptiveStaleNodes(listNodes({ type: 'task', status: 'active' }), now),
    ...computeAdaptiveStaleNodes(listNodes({ type: 'plan_item', status: 'active' }), now),
  ];

  return {
    energyIndex,
    funnel: computeFunnelRates(counts),
    staleNodeTitles: staleNodes.map((n) => n.title),
  };
}

export * from './energyIndex';
export * from './funnel';
export * from './staleDetection';
