// Mastery engine (pure functions).
//
// Estimates mastery from a stream of question attempts at four granularities
// (programme → course → topic → concept/skill) using weighted, recency-biased
// accuracy. The key product rule: a student who passes easy items but fails
// application-level items is NEVER classified as mastered (applicationGap).

import type { MasteryLevel } from "../types";

export type { MasteryLevel } from "../types";

export interface AttemptRecord {
  /** 1..5 */
  difficulty: number;
  correct: boolean | null; // null = needs review (not counted as failure)
  /** 0..2+ */
  hintsUsed: number;
  /** ISO timestamp */
  at: string;
}

export interface MasteryEstimate {
  score: number; // 0..100
  level: MasteryLevel;
  confidence: number; // 0..100 — driven by attempt volume
  attempts: number;
  easyAccuracy: number | null; // 0..100 over difficulty 1-2
  applicationAccuracy: number | null; // 0..100 over difficulty 3-5
  applicationGap: boolean;
}

/** Fresh empty estimate — never share a mutable object. */
const emptyEstimate = (): MasteryEstimate => ({
  score: 0,
  level: "not_assessed",
  confidence: 0,
  attempts: 0,
  easyAccuracy: null,
  applicationAccuracy: null,
  applicationGap: false,
});

/** Attempts count as "easy" at difficulty <= 2, "application" at >= 3. */
export function estimateMastery(attempts: AttemptRecord[]): MasteryEstimate {
  const scored = attempts.filter((a) => a.correct !== null);
  if (scored.length === 0) return emptyEstimate();

  // Recency bias: newest attempt gets the highest weight (2x oldest-ish).
  const n = scored.length;
  const withWeight = scored.map((a, i) => ({
    a,
    weight: a.difficulty * (1 + (i / Math.max(1, n - 1))),
  }));

  let totalWeight = 0;
  let correctWeight = 0;
  let easyTotal = 0;
  let easyCorrect = 0;
  let appTotal = 0;
  let appCorrect = 0;

  for (const { a, weight } of withWeight) {
    totalWeight += weight;
    if (a.correct) correctWeight += weight;
    if (a.difficulty <= 2) {
      easyTotal += 1;
      if (a.correct) easyCorrect += 1;
    } else {
      appTotal += 1;
      if (a.correct) appCorrect += 1;
    }
  }

  const score = Math.round((correctWeight / totalWeight) * 100);
  const easyAccuracy = easyTotal ? Math.round((easyCorrect / easyTotal) * 100) : null;
  const applicationAccuracy = appTotal ? Math.round((appCorrect / appTotal) * 100) : null;

  // Discrimination rule: strong on easy items but weak on application items
  // caps the level at "developing" and flags the gap. Requires enough
  // evidence in both bands (>=3 attempts each) so one-off misses don't
  // trigger it.
  const applicationGap =
    easyTotal >= 3 &&
    appTotal >= 3 &&
    (easyAccuracy ?? 0) >= 80 &&
    (applicationAccuracy ?? 0) < 60;

  let level: MasteryLevel;
  if (score < 40) level = "weak";
  else if (score < 65) level = "developing";
  else if (score < 85) level = "strong";
  else level = "mastered";
  if (applicationGap && (level === "mastered" || level === "strong")) level = "developing";

  // Confidence: volume of attempts, capped, penalised when the student only
  // ever faced one difficulty band.
  const bandCoverage = easyAccuracy !== null && applicationAccuracy !== null ? 1 : 0.7;
  const confidence = Math.round(Math.min(100, scored.length * 12) * bandCoverage);

  return {
    score,
    level,
    confidence,
    attempts: scored.length,
    easyAccuracy,
    applicationAccuracy,
    applicationGap,
  };
}

/** Weighted roll-up of child estimates into a parent (topic→course→programme). */
export function aggregateMastery(children: { estimate: MasteryEstimate; weight: number }[]): MasteryEstimate {
  const considered = children.filter((c) => c.estimate.attempts > 0 && c.weight > 0);
  if (!considered.length) return emptyEstimate();
  const totalWeight = considered.reduce((s, c) => s + c.weight, 0);
  const score = Math.round(considered.reduce((s, c) => s + c.estimate.score * c.weight, 0) / totalWeight);
  const attempts = considered.reduce((s, c) => s + c.estimate.attempts, 0);
  const gaps = considered.filter((c) => c.estimate.applicationGap).length;
  let level: MasteryLevel =
    score < 40 ? "weak" : score < 65 ? "developing" : score < 85 ? "strong" : "mastered";
  // A parent is capped at "developing" when a majority of its children show
  // an application gap.
  if (gaps > considered.length / 2 && (level === "mastered" || level === "strong")) {
    level = "developing";
  }
  return {
    score,
    level,
    confidence: Math.round(considered.reduce((s, c) => s + c.estimate.confidence * c.weight, 0) / totalWeight),
    attempts,
    easyAccuracy: null,
    applicationAccuracy: null,
    applicationGap: gaps > 0,
  };
}

// ---------------------------------------------------------------------------
// SM-2 spaced repetition (matches review_schedule.interval_days / ease_factor)
// ---------------------------------------------------------------------------

export interface Sm2State {
  intervalDays: number;
  easeFactor: number;
}

export interface Sm2Result extends Sm2State {
  /** Days until the next review from `now`. */
  nextInDays: number;
}

/**
 * quality: 0..5 (0-2 = failure, 3-5 = success; map from score: <50→2, <65→3, <80→4, else 5)
 */
export function sm2(state: Sm2State, quality: number, now: Date = new Date()): Sm2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { intervalDays, easeFactor } = state;
  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < 3) {
    intervalDays = 1;
  } else if (intervalDays < 1) {
    intervalDays = 1;
  } else if (intervalDays < 6) {
    intervalDays = 6;
  } else {
    intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
  }

  const next = new Date(now);
  next.setUTCDate(next.getUTCDate() + intervalDays);
  return { intervalDays, easeFactor, nextInDays: intervalDays };
}

export function qualityFromScore(score: number): number {
  if (score < 50) return 2;
  if (score < 65) return 3;
  if (score < 80) return 4;
  return 5;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}
