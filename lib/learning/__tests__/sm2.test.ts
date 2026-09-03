import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeMasteryLevel, DEFAULT_SM2_STATE, nextSm2State } from '../sm2';

test('a failed review (quality < 3) resets repetitions and interval to 1 day', () => {
  const prev = { reviewCount: 5, easeFactor: 2.5, reviewIntervalDays: 30 };
  const next = nextSm2State(prev, 2);
  assert.equal(next.reviewCount, 0);
  assert.equal(next.reviewIntervalDays, 1);
  assert.equal(next.easeFactor, prev.easeFactor);
});

test('first successful review sets interval to 1 day, second to 6 days', () => {
  const first = nextSm2State(DEFAULT_SM2_STATE, 4);
  assert.equal(first.reviewIntervalDays, 1);
  assert.equal(first.reviewCount, 1);

  const second = nextSm2State(first, 4);
  assert.equal(second.reviewIntervalDays, 6);
  assert.equal(second.reviewCount, 2);
});

test('third+ successful review multiplies interval by ease factor', () => {
  const first = nextSm2State(DEFAULT_SM2_STATE, 4);
  const second = nextSm2State(first, 4);
  const third = nextSm2State(second, 4);
  assert.equal(third.reviewIntervalDays, Math.round(second.reviewIntervalDays * second.easeFactor));
});

test('ease factor never drops below 1.3', () => {
  let state = DEFAULT_SM2_STATE;
  for (let i = 0; i < 20; i++) {
    state = nextSm2State(state, 3);
  }
  assert.ok(state.easeFactor >= 1.3);
});

test('computeMasteryLevel is bounded 0-100 and increases with more reviews', () => {
  const early = computeMasteryLevel({ reviewCount: 1, easeFactor: 2.5, reviewIntervalDays: 1 });
  const mature = computeMasteryLevel({ reviewCount: 10, easeFactor: 2.8, reviewIntervalDays: 60 });
  assert.ok(early >= 0 && early <= 100);
  assert.ok(mature >= 0 && mature <= 100);
  assert.ok(mature > early);
});
