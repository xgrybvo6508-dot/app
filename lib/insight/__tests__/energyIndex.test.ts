import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeCadenceScore,
  computeCompletionVelocity,
  computeEnergyIndex,
  computeStreakDays,
  countStatusRegressions,
} from '../energyIndex';
import type { ActivityEvent } from '../../db/types';

function makeEvent(partial: Partial<ActivityEvent> & { type: ActivityEvent['type'] }): ActivityEvent {
  return {
    id: Math.random().toString(),
    nodeId: null,
    edgeId: null,
    fromStatus: null,
    toStatus: null,
    createdAt: new Date().toISOString(),
    metadata: {},
    ...partial,
  };
}

test('computeCadenceScore returns ratio 0 when there is no activity at all', () => {
  const now = new Date('2024-01-31T00:00:00.000Z');
  const result = computeCadenceScore([], now);
  assert.equal(result.ratio, 0);
});

test('computeCadenceScore ratio rises when recent activity outpaces the 30d baseline', () => {
  const now = new Date('2024-01-31T00:00:00.000Z');
  // A single event within the last 7 days is also within the 30-day baseline window,
  // so it pulls recentPerDay (1/7) above the diluted baselinePerDay (1/30).
  const events = [makeEvent({ type: 'node_created', createdAt: '2024-01-30T00:00:00.000Z' })];
  const result = computeCadenceScore(events, now);
  assert.equal(result.ratio, 30 / 7);
});

test('computeCompletionVelocity is 1 when done count equals created count', () => {
  const now = new Date('2024-01-31T00:00:00.000Z');
  const events = [
    makeEvent({ type: 'node_created', createdAt: '2024-01-29T00:00:00.000Z' }),
    makeEvent({
      type: 'status_changed',
      toStatus: 'done',
      createdAt: '2024-01-30T00:00:00.000Z',
    }),
  ];
  assert.equal(computeCompletionVelocity(events, 7, now), 1);
});

test('countStatusRegressions counts done->active and in_progress->active', () => {
  const now = new Date('2024-01-31T00:00:00.000Z');
  const events = [
    makeEvent({
      type: 'status_changed',
      fromStatus: 'done',
      toStatus: 'active',
      createdAt: '2024-01-30T00:00:00.000Z',
    }),
    makeEvent({
      type: 'status_changed',
      fromStatus: 'in_progress',
      toStatus: 'active',
      createdAt: '2024-01-30T00:00:00.000Z',
    }),
    makeEvent({
      type: 'status_changed',
      fromStatus: 'active',
      toStatus: 'done',
      createdAt: '2024-01-30T00:00:00.000Z',
    }),
  ];
  assert.equal(countStatusRegressions(events, 7, now), 2);
});

test('computeStreakDays counts consecutive days ending today', () => {
  const now = new Date('2024-01-31T12:00:00.000Z');
  const events = [
    makeEvent({ type: 'node_created', createdAt: '2024-01-31T01:00:00.000Z' }),
    makeEvent({ type: 'node_created', createdAt: '2024-01-30T01:00:00.000Z' }),
    makeEvent({ type: 'node_created', createdAt: '2024-01-28T01:00:00.000Z' }), // gap on 29th
  ];
  assert.equal(computeStreakDays(events, now), 2);
});

test('computeEnergyIndex is bounded between 0 and 100', () => {
  const low = computeEnergyIndex({
    cadenceRatio: 0,
    completionVelocity: 0,
    statusRegressions: 100,
    streakDays: 0,
  });
  const high = computeEnergyIndex({
    cadenceRatio: 2,
    completionVelocity: 1,
    statusRegressions: 0,
    streakDays: 30,
  });
  assert.ok(low >= 0 && low <= 100);
  assert.ok(high >= 0 && high <= 100);
  assert.ok(high > low);
});
