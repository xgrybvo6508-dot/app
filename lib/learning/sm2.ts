// SM-2 (SuperMemo 2) spaced-repetition algorithm — see plan's Обучение section.
// Pure function: no DB access, easy to unit test.
export interface Sm2State {
  reviewCount: number;
  easeFactor: number;
  reviewIntervalDays: number;
}

export const DEFAULT_SM2_STATE: Sm2State = {
  reviewCount: 0,
  easeFactor: 2.5,
  reviewIntervalDays: 0,
};

/** quality: 0-5 recall rating. UI maps Again/Hard/Good/Easy to 2/3/4/5. */
export function nextSm2State(prev: Sm2State, quality: number): Sm2State {
  const q = Math.max(0, Math.min(5, quality));

  if (q < 3) {
    return {
      reviewCount: 0,
      easeFactor: prev.easeFactor,
      reviewIntervalDays: 1,
    };
  }

  const reviewCount = prev.reviewCount + 1;
  let reviewIntervalDays: number;
  if (reviewCount === 1) reviewIntervalDays = 1;
  else if (reviewCount === 2) reviewIntervalDays = 6;
  else reviewIntervalDays = Math.round(prev.reviewIntervalDays * prev.easeFactor);

  const easeFactor = Math.max(
    1.3,
    prev.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  return { reviewCount, easeFactor, reviewIntervalDays };
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** 0-100 mastery display value derived from ease factor + review count — not raw SM-2 internals. */
export function computeMasteryLevel(state: Sm2State): number {
  const easeComponent = Math.min((state.easeFactor - 1.3) / (2.8 - 1.3), 1);
  const countComponent = Math.min(state.reviewCount / 8, 1);
  return Math.round((easeComponent * 0.5 + countComponent * 0.5) * 100);
}
