import { describe, expect, it } from "vitest";
import { estimateMastery } from "../src/lib/mastery";
import { generateRecommendations, type RecSnapshot } from "../src/lib/recommendations";

const NOW = new Date("2026-08-24T09:00:00Z");

const est = (score: number, level: string, attempts: number) =>
  Object.assign(estimateMastery([]), { score, level, attempts, applicationGap: false, easyAccuracy: null, applicationAccuracy: null, confidence: 50 });

const snap = (over: Partial<RecSnapshot> = {}): RecSnapshot => ({
  now: NOW,
  topics: [
    { id: "t1", course_id: "c1", courseName: "Calculus I", name: "Differentiation", sequence_number: 1, status: "student_added" },
    { id: "t2", course_id: "c1", courseName: "Calculus I", name: "Integration", sequence_number: 2, status: "student_added" },
    { id: "t3", course_id: "c2", courseName: "Physics I", name: "Motion", sequence_number: 1, status: "student_added" },
  ],
  mastery: {},
  reviews: {},
  prerequisiteEdges: [],
  activeSessions: {},
  ...over,
});

describe("generateRecommendations", () => {
  it("recommends continuing an in-progress session first", () => {
    const recs = generateRecommendations(
      snap({ activeSessions: { t2: { progressPercent: 60, sessionTitle: "Integration" } } }),
    );
    expect(recs[0].type).toBe("continue");
    expect(recs[0].topic_id).toBe("t2");
    expect(recs[0].reason).toMatch(/60%/);
  });

  it("flags prerequisite gaps with a why", () => {
    const recs = generateRecommendations(
      snap({
        prerequisiteEdges: [{ from: "t1", to: "t2" }],
        mastery: {
          t1: est(45, "weak", 8),
          t2: est(0, "not_assessed", 0),
        },
      }),
    );
    const rec = recs.find((r) => r.type === "prerequisite");
    expect(rec).toBeTruthy();
    expect(rec?.topic_id).toBe("t2");
    expect(rec?.related_topic_id).toBe("t1");
    expect(rec?.reason).toMatch(/builds directly on/);
  });

  it("does not flag a prerequisite gap when the base topic is solid", () => {
    const recs = generateRecommendations(
      snap({
        prerequisiteEdges: [{ from: "t1", to: "t2" }],
        mastery: {
          t1: est(90, "mastered", 20),
          t2: est(0, "not_assessed", 0),
        },
      }),
    );
    expect(recs.find((r) => r.type === "prerequisite")).toBeUndefined();
  });

  it("detects the theory-vs-application gap", () => {
    const withGap = Object.assign(est(50, "developing", 8), {
      applicationGap: true,
      easyAccuracy: 100,
      applicationAccuracy: 20,
    });
    const recs = generateRecommendations(snap({ mastery: { t1: withGap } }));
    const rec = recs.find((r) => r.type === "application_practice");
    expect(rec).toBeTruthy();
    expect(rec?.reason).toMatch(/application-level items/);
  });

  it("surfaces overdue reviews with the number of days", () => {
    const recs = generateRecommendations(
      snap({ reviews: { t3: new Date(NOW.getTime() - 14 * 86400000).toISOString() } }),
    );
    const rec = recs.find((r) => r.type === "review");
    expect(rec).toBeTruthy();
    expect(rec?.reason).toMatch(/14 days/);
  });

  it("does not recommend reviews that are not due yet", () => {
    const recs = generateRecommendations(
      snap({ reviews: { t3: new Date(NOW.getTime() + 5 * 86400000).toISOString() } }),
    );
    expect(recs.find((r) => r.type === "review")).toBeUndefined();
  });

  it("recommends rebuilding weak topics after enough evidence", () => {
    const recs = generateRecommendations(snap({ mastery: { t3: est(30, "weak", 5) } }));
    const rec = recs.find((r) => r.type === "weak_area");
    expect(rec).toBeTruthy();
    expect(rec?.reason).toMatch(/30%/);
  });

  it("recommends weak topics only after at least 3 attempts", () => {
    const recs = generateRecommendations(snap({ mastery: { t3: est(30, "weak", 2) } }));
    expect(recs.find((r) => r.type === "weak_area")).toBeUndefined();
  });

  it("recommends the next topic when the previous one is solid and the next is untouched", () => {
    const recs = generateRecommendations(
      snap({ mastery: { t1: est(88, "strong", 12) } }),
    );
    const rec = recs.find((r) => r.type === "ready_next");
    expect(rec).toBeTruthy();
    expect(rec?.topic_id).toBe("t2");
  });

  it("falls back to a fresh-start suggestion so the dashboard is never empty", () => {
    const recs = generateRecommendations(snap());
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].type).toBe("fresh_start");
  });

  it("orders by priority", () => {
    const recs = generateRecommendations(
      snap({
        activeSessions: { t1: { progressPercent: 40, sessionTitle: "x" } },
        mastery: { t3: est(30, "weak", 5) },
      }),
    );
    const priorities = recs.map((r) => r.priority);
    expect([...priorities].sort((a, b) => b - a)).toEqual(priorities);
  });
});
