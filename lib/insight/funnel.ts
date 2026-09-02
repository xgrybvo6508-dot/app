// Funnel conversion + "leak" detection — see plan's Insight-движок section.
// idea → task/plan_item → done → knowledge_applied → reviewed
import type { GraphNode } from '../db/types';

export interface FunnelRates {
  ideaToTaskRate: number;
  taskCompletionRate: number;
  knowledgeAppliedRate: number;
  researchUtilizedRate: number;
}

export interface FunnelCounts {
  ideasTotal: number;
  ideasLinkedToTask: number;
  tasksTotal: number;
  tasksDone: number;
  knowledgeItemsTotal: number;
  knowledgeItemsApplied: number;
  researchFindingsTotal: number;
  researchFindingsUtilized: number;
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function computeFunnelRates(counts: FunnelCounts): FunnelRates {
  return {
    ideaToTaskRate: safeRate(counts.ideasLinkedToTask, counts.ideasTotal),
    taskCompletionRate: safeRate(counts.tasksDone, counts.tasksTotal),
    knowledgeAppliedRate: safeRate(counts.knowledgeItemsApplied, counts.knowledgeItemsTotal),
    researchUtilizedRate: safeRate(counts.researchFindingsUtilized, counts.researchFindingsTotal),
  };
}

export type FunnelStage = keyof FunnelRates;

export interface FunnelLeak {
  stage: FunnelStage;
  currentRate: number;
  baselineRate: number;
  drop: number; // baselineRate - currentRate, relative to the user's OWN history
}

/**
 * Finds the stage with the largest drop vs the user's own historical baseline
 * for that stage — never an absolute/external benchmark (product guardrail).
 */
export function detectFunnelLeak(
  current: FunnelRates,
  baseline: FunnelRates,
): FunnelLeak | null {
  const stages = Object.keys(current) as FunnelStage[];
  let worst: FunnelLeak | null = null;

  for (const stage of stages) {
    const drop = baseline[stage] - current[stage];
    if (drop > 0 && (!worst || drop > worst.drop)) {
      worst = { stage, currentRate: current[stage], baselineRate: baseline[stage], drop };
    }
  }

  return worst;
}

/** knowledge_item / research_finding nodes explicitly opted out of the funnel (see "learned из любопытства"). */
export function excludeCuriosityOnly(nodes: GraphNode[]): GraphNode[] {
  return nodes.filter((n) => !(n.attributes as { curiosityOnly?: boolean }).curiosityOnly);
}
