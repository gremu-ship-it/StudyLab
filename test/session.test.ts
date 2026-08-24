import { describe, expect, it } from "vitest";
import {
  activeStepNumber,
  applyDiagnosticScore,
  buildSessionPlan,
  fastTrackSkippedSteps,
  isSessionComplete,
  sessionProgress,
} from "../src/lib/session";
import type { LearningUnit, Question } from "../src/types";

const unit = (n: number, unit_type: LearningUnit["unit_type"], title = `Unit ${n}`): LearningUnit => ({
  id: `u${n}`,
  topic_id: "t1",
  subtopic_id: null,
  title,
  unit_type,
  sequence_number: n,
  description: null,
  body: null,
  formula: null,
  media: {},
  estimated_minutes: 10,
  difficulty: null,
  status: "approved",
  source_type: null,
  source_reference: null,
  created_by: null,
});

const question = (n: number, difficulty: number, is_diagnostic = false): Question => ({
  id: `q${n}`,
  topic_id: "t1",
  subtopic_id: null,
  question_type: "multiple_choice",
  difficulty,
  question_text: `Question ${n}`,
  explanation: null,
  hint_1: null,
  hint_2: null,
  correct_answer: { option_key: "A" },
  is_diagnostic,
  scaffolding: {},
  status: "approved",
  concept_id: null,
  skill_id: null,
  learning_objective_id: null,
  created_by: null,
});

describe("buildSessionPlan", () => {
  const base = {
    topicName: "Motion",
    units: [unit(1, "explanation"), unit(2, "worked_example")],
    questions: [question(1, 1), question(2, 2), question(3, 3)],
    practicals: [],
    objectives: [],
  };

  it("orders: units → easy practice → assessment (hardest reserved) → reflection → mastery", () => {
    const plan = buildSessionPlan(base);
    const types = plan.steps.map((s) => s.stepType);
    expect(types).toEqual([
      "explanation",
      "worked_example",
      "practice",
      "practice",
      "assessment",
      "reflection",
      "mastery",
    ]);
    expect(plan.hasDiagnostic).toBe(false);
  });

  it("inserts application steps for mid-difficulty questions before the assessment", () => {
    const plan = buildSessionPlan({
      ...base,
      questions: [question(1, 1), question(2, 2), question(3, 3), question(4, 4)],
    });
    const types = plan.steps.map((s) => s.stepType);
    expect(types).toEqual([
      "explanation",
      "worked_example",
      "practice",
      "practice",
      "application",
      "assessment",
      "reflection",
      "mastery",
    ]);
    expect(plan.steps.find((s) => s.stepType === "assessment")?.question?.id).toBe("q4");
  });

  it("puts objectives first and diagnostic second when present", () => {
    const plan = buildSessionPlan({
      ...base,
      objectives: [
        {
          id: "o1",
          course_id: null,
          topic_id: "t1",
          concept_id: null,
          statement: "Describe motion using graphs",
          sequence_number: 1,
          status: "active",
          source_type: null,
          created_by: null,
        },
      ],
      questions: [question(9, 1, true), question(1, 1), question(3, 3)],
    });
    const types = plan.steps.map((s) => s.stepType);
    expect(types[0]).toBe("objective");
    expect(types[1]).toBe("diagnostic");
    expect(plan.hasDiagnostic).toBe(true);
    // the diagnostic question must not also appear as a practice step
    expect(plan.steps.filter((s) => s.question?.id === "q9")).toHaveLength(1);
  });

  it("adds practical steps before assessment", () => {
    const plan = buildSessionPlan({
      ...base,
      practicals: [
        {
          id: "p1",
          topic_id: "t1",
          title: "Measure acceleration",
          objective: null,
          background: null,
          materials: null,
          safety_notes: null,
          procedure: null,
          expected_outcome: null,
          status: "approved",
        },
      ],
    });
    const types = plan.steps.map((s) => s.stepType);
    const practicalIdx = types.indexOf("practical");
    expect(practicalIdx).toBeGreaterThan(-1);
    expect(practicalIdx).toBeLessThan(types.lastIndexOf("assessment"));
  });

  it("does not duplicate the assessment question into practice twice", () => {
    const plan = buildSessionPlan(base);
    const assessment = plan.steps.find((s) => s.stepType === "assessment");
    expect(assessment?.question?.id).toBe("q3");
    const usedForAssessment = plan.steps.filter((s) => s.question?.id === "q3");
    expect(usedForAssessment).toHaveLength(1);
  });

  it("marks easy practice and explanation steps as fast-track eligible, but not application", () => {
    const plan = buildSessionPlan({
      ...base,
      questions: [question(1, 1), question(2, 2), question(3, 3), question(4, 4)],
    });
    const skipped = fastTrackSkippedSteps(plan);
    expect(skipped.has(plan.steps[0].number)).toBe(true); // explanation unit
    const easyPractice = plan.steps.find((s) => s.stepType === "practice");
    expect(skipped.has(easyPractice!.number)).toBe(true);
    const application = plan.steps.find((s) => s.stepType === "application");
    expect(skipped.has(application!.number)).toBe(false);
    const assessment = plan.steps.find((s) => s.stepType === "assessment");
    expect(skipped.has(assessment!.number)).toBe(false);
  });
});

describe("diagnostic outcomes", () => {
  it("strong diagnostic fast-tracks with a lower hint budget", () => {
    const o = applyDiagnosticScore(90);
    expect(o.fastTrack).toBe(true);
    expect(o.hintBudget).toBe(1);
  });
  it("mid diagnostic keeps the standard run", () => {
    const o = applyDiagnosticScore(60);
    expect(o.fastTrack).toBe(false);
    expect(o.hintBudget).toBe(2);
    expect(o.difficultyFloor).toBe(2);
  });
  it("weak diagnostic starts from foundations with more hints", () => {
    const o = applyDiagnosticScore(30);
    expect(o.fastTrack).toBe(false);
    expect(o.hintBudget).toBe(3);
    expect(o.difficultyFloor).toBe(1);
  });
});

describe("unlock & progress", () => {
  const plan = buildSessionPlan({
    topicName: "Motion",
    units: [unit(1, "explanation")],
    questions: [question(1, 1), question(2, 2)],
    practicals: [],
    objectives: [],
  });
  // steps: explanation(1), practice(2), assessment(3), reflection(4), mastery(5)

  it("only the first step is active at the start; later steps are locked", () => {
    expect(activeStepNumber(plan, new Set(), new Set())).toBe(1);
  });

  it("advances after completion and skips fast-tracked steps", () => {
    const completed = new Set([1]);
    const skipped = new Set(plan.steps.filter((s) => s.fastTrackEligible).map((s) => s.number));
    expect(activeStepNumber(plan, completed, skipped)).toBe(3); // practice (2) skipped → reflection
  });

  it("reports 100% progress and completion only when everything is done or skipped", () => {
    const completed = new Set([1]);
    const skipped = new Set(plan.steps.filter((s) => s.fastTrackEligible).map((s) => s.number));
    expect(sessionProgress(plan, completed, skipped)).toBeLessThan(100);
    completed.add(3);
    completed.add(4);
    completed.add(5);
    expect(sessionProgress(plan, completed, skipped)).toBe(100);
    expect(isSessionComplete(plan, completed, skipped)).toBe(true);
  });
});
