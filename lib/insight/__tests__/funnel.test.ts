import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeFunnelRates, detectFunnelLeak, type FunnelCounts } from '../funnel';

const baseCounts: FunnelCounts = {
  ideasTotal: 10,
  ideasLinkedToTask: 2,
  tasksTotal: 5,
  tasksDone: 4,
  knowledgeItemsTotal: 8,
  knowledgeItemsApplied: 6,
  researchFindingsTotal: 4,
  researchFindingsUtilized: 4,
};

test('computeFunnelRates computes safe ratios', () => {
  const rates = computeFunnelRates(baseCounts);
  assert.equal(rates.ideaToTaskRate, 0.2);
  assert.equal(rates.taskCompletionRate, 0.8);
  assert.equal(rates.knowledgeAppliedRate, 0.75);
  assert.equal(rates.researchUtilizedRate, 1);
});

test('computeFunnelRates returns 0 for empty denominators instead of NaN', () => {
  const rates = computeFunnelRates({
    ideasTotal: 0,
    ideasLinkedToTask: 0,
    tasksTotal: 0,
    tasksDone: 0,
    knowledgeItemsTotal: 0,
    knowledgeItemsApplied: 0,
    researchFindingsTotal: 0,
    researchFindingsUtilized: 0,
  });
  assert.equal(rates.ideaToTaskRate, 0);
  assert.equal(Number.isNaN(rates.ideaToTaskRate), false);
});

test('detectFunnelLeak finds the stage with the largest drop vs baseline', () => {
  const baseline = computeFunnelRates(baseCounts);
  const current = computeFunnelRates({ ...baseCounts, ideasLinkedToTask: 0 });
  const leak = detectFunnelLeak(current, baseline);
  assert.ok(leak);
  assert.equal(leak?.stage, 'ideaToTaskRate');
});

test('detectFunnelLeak returns null when nothing dropped', () => {
  const rates = computeFunnelRates(baseCounts);
  assert.equal(detectFunnelLeak(rates, rates), null);
});
