import { describe, expect, it } from "vitest";
import { aggregateMastery, estimateMastery, qualityFromScore, sm2 } from "../src/lib/mastery";

const at = (difficulty: number, correct: boolean | null, hints = 0, day = 1) => ({
  difficulty,
  correct,
  hintsUsed: hints,
  at: new Date(Date.UTC(2026, 7, day)).toISOString(),
});

describe("estimateMastery", () => {
  it("is not assessed without attempts", () => {
    const m = estimateMastery([]);
    expect(m.level).toBe("not_assessed");
    expect(m.attempts).toBe(0);
  });

  it("ignores needs-review attempts (correct = null) in the score", () => {
    const m = estimateMastery([at(3, null), at(3, null)]);
    expect(m.level).toBe("not_assessed");
    const m2 = estimateMastery([at(3, null), at(3, true)]);
    expect(m2.attempts).toBe(1);
  });

  it("classifies weak / developing / strong / mastered", () => {
    expect(estimateMastery([at(1, false), at(1, false), at(2, false)]).level).toBe("weak");
    expect(estimateMastery([at(1, false), at(1, true), at(2, false), at(2, true)]).level).toBe("developing");
    const strong = estimateMastery([at(2, true), at(3, true), at(3, false), at(4, true)]);
    expect(strong.level).toBe("strong");
    const mastered = estimateMastery([at(2, true), at(3, true), at(3, true), at(4, true), at(5, true), at(4, true)]);
    expect(mastered.level).toBe("mastered");
  });

  it("weighs harder items more", () => {
    // Two easy wrongs vs two hard rights: hard items dominate.
    const m = estimateMastery([at(1, false), at(2, false), at(4, true), at(5, true)]);
    expect(m.score).toBeGreaterThan(50);
  });

  it("caps mastery when easy items pass but application items fail (the core product rule)", () => {
    const m = estimateMastery([
      at(1, true), at(1, true), at(1, true), at(2, true), at(2, true), // easy: 100%
      at(3, false), at(4, false), at(3, false), // application: 0%
    ]);
    expect(m.applicationGap).toBe(true);
    expect(m.easyAccuracy).toBe(100);
    expect(m.applicationAccuracy).toBe(0);
    expect(["weak", "developing"]).toContain(m.level);
    expect(m.level).not.toBe("mastered");
    expect(m.level).not.toBe("strong");
  });

  it("does not flag a gap when application performance is fine", () => {
    const m = estimateMastery([at(1, true), at(2, true), at(3, true), at(4, true)]);
    expect(m.applicationGap).toBe(false);
  });

  it("confidence grows with attempt volume", () => {
    const few = estimateMastery([at(1, true)]);
    const many = estimateMastery([
      at(1, true), at(2, true), at(3, true), at(3, true), at(4, true), at(4, true), at(5, true),
    ]);
    expect(many.confidence).toBeGreaterThan(few.confidence);
  });

  it("aggregateMastery rolls children up and propagates gaps", () => {
    const mastered = estimateMastery([at(2, true), at(3, true), at(3, true), at(4, true), at(5, true), at(4, true)]);
    const gap = estimateMastery([
      at(1, true), at(1, true), at(1, true),
      at(3, false), at(3, false), at(4, false),
    ]);
    const agg = aggregateMastery([
      { estimate: mastered, weight: 1 },
      { estimate: gap, weight: 1 },
    ]);
    expect(agg.attempts).toBe(mastered.attempts + gap.attempts);
    expect(agg.applicationGap).toBe(true);
  });
});

describe("sm2 spaced repetition", () => {
  it("starts at 1 day, then 6 days, then interval * EF", () => {
    let state = { intervalDays: 0, easeFactor: 2.5 };
    const r1 = sm2(state, 5, new Date("2026-08-24"));
    expect(r1.intervalDays).toBe(1);
    state = { intervalDays: r1.intervalDays, easeFactor: r1.easeFactor };
    const r2 = sm2(state, 5);
    expect(r2.intervalDays).toBe(6);
    state = { intervalDays: r2.intervalDays, easeFactor: r2.easeFactor };
    const r3 = sm2(state, 5);
    expect(r3.intervalDays).toBeGreaterThan(6);
  });

  it("resets to 1 day on failure and lowers the ease factor below 1.3 minimum", () => {
    const state = { intervalDays: 21, easeFactor: 2.5 };
    const r = sm2(state, 2);
    expect(r.intervalDays).toBe(1);
    const bad = sm2({ intervalDays: 30, easeFactor: 1.35 }, 0);
    expect(bad.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("qualityFromScore maps scores onto the 0..5 scale", () => {
    expect(qualityFromScore(30)).toBe(2);
    expect(qualityFromScore(60)).toBe(3);
    expect(qualityFromScore(75)).toBe(4);
    expect(qualityFromScore(95)).toBe(5);
  });
});
