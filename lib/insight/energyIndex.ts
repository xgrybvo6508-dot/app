// Pure metric calculations for the "Energy Index" — see plan's Insight-движок
// section. Every signal is derived from activity_log timestamps and node
// status transitions, never from NLP over note text (explicit product guardrail).
import type { ActivityEvent, GraphNode } from '../db/types';

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

function eventsInWindow(events: ActivityEvent[], windowDays: number, now: Date): ActivityEvent[] {
  return events.filter((e) => daysBetween(now, new Date(e.createdAt)) <= windowDays);
}

/** Recent (7d) event count vs the user's own trailing baseline (30d daily average). */
export function computeCadenceScore(
  events: ActivityEvent[],
  now: Date = new Date(),
): { recentPerDay: number; baselinePerDay: number; ratio: number } {
  const recent = eventsInWindow(events, 7, now).length / 7;
  const baseline = eventsInWindow(events, 30, now).length / 30;
  const ratio = baseline === 0 ? (recent > 0 ? 1 : 0) : recent / baseline;
  return { recentPerDay: recent, baselinePerDay: baseline, ratio };
}

/** done/created ratio over a window — sustained < 1 with rising backlog signals overload. */
export function computeCompletionVelocity(
  events: ActivityEvent[],
  windowDays = 7,
  now: Date = new Date(),
): number {
  const windowed = eventsInWindow(events, windowDays, now);
  const created = windowed.filter((e) => e.type === 'node_created').length;
  const completed = windowed.filter(
    (e) => e.type === 'status_changed' && e.toStatus === 'done',
  ).length;
  if (created === 0) return completed > 0 ? 1 : 0;
  return completed / created;
}

/** done→active / in_progress→active regressions in the window — friction without text sentiment. */
export function countStatusRegressions(
  events: ActivityEvent[],
  windowDays = 7,
  now: Date = new Date(),
): number {
  return eventsInWindow(events, windowDays, now).filter(
    (e) =>
      e.type === 'status_changed' &&
      e.toStatus === 'active' &&
      (e.fromStatus === 'done' || e.fromStatus === 'in_progress'),
  ).length;
}

// Local calendar day (not UTC) — timestamps are bucketed by the device's own
// day boundary, otherwise evening activity in timezones ahead of UTC rolls
// into "tomorrow" and breaks the streak even though the user was active
// every day from their own perspective.
function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Consecutive days (ending today) with at least one event. */
export function computeStreakDays(events: ActivityEvent[], now: Date = new Date()): number {
  const daysWithActivity = new Set(events.map((e) => localDayKey(new Date(e.createdAt))));
  let streak = 0;
  const cursor = new Date(now);
  while (daysWithActivity.has(localDayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Median hours from an idea's creation to the first edge linking it to a task/plan_item. */
export function computeIdeaToActionLagHours(
  ideas: GraphNode[],
  firstActionEdgeCreatedAt: Map<string, string>,
): number | null {
  const lags: number[] = [];
  for (const idea of ideas) {
    const firstAction = firstActionEdgeCreatedAt.get(idea.id);
    if (!firstAction) continue;
    const hours =
      (new Date(firstAction).getTime() - new Date(idea.createdAt).getTime()) / (1000 * 60 * 60);
    if (hours >= 0) lags.push(hours);
  }
  if (lags.length === 0) return null;
  lags.sort((a, b) => a - b);
  const mid = Math.floor(lags.length / 2);
  return lags.length % 2 === 0 ? (lags[mid - 1] + lags[mid]) / 2 : lags[mid];
}

export interface EnergyIndexInputs {
  cadenceRatio: number; // computeCadenceScore().ratio
  completionVelocity: number; // 0..1+ ideally near 1
  statusRegressions: number; // count in window, lower is better
  streakDays: number;
}

/**
 * Composite 0-100 score, always relative to the user's own baseline
 * (cadenceRatio is already self-relative) — never compared across users.
 */
export function computeEnergyIndex(inputs: EnergyIndexInputs): number {
  const cadenceComponent = Math.min(inputs.cadenceRatio, 1.5) / 1.5; // cap upside
  const velocityComponent = Math.min(inputs.completionVelocity, 1);
  const regressionPenalty = Math.min(inputs.statusRegressions * 0.05, 0.3);
  const streakComponent = Math.min(inputs.streakDays / 14, 1);

  const raw =
    cadenceComponent * 0.35 +
    velocityComponent * 0.35 +
    streakComponent * 0.3 -
    regressionPenalty;

  return Math.round(Math.max(0, Math.min(1, raw)) * 100);
}
