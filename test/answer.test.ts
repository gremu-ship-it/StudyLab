import { describe, expect, it } from "vitest";
import { checkAnswer } from "../src/lib/answer";
import type { Question } from "../src/types";

const q = (over: Partial<Question>): Question => ({
  id: "q1",
  topic_id: "t1",
  subtopic_id: null,
  question_type: "multiple_choice",
  difficulty: 1,
  question_text: "test",
  explanation: null,
  hint_1: null,
  hint_2: null,
  correct_answer: {},
  is_diagnostic: false,
  scaffolding: {},
  status: "approved",
  concept_id: null,
  skill_id: null,
  learning_objective_id: null,
  created_by: null,
  ...over,
});

describe("checkAnswer", () => {
  it("checks multiple choice", () => {
    const question = q({ question_type: "multiple_choice", correct_answer: { option_key: "B" } });
    expect(checkAnswer(question, "B").correct).toBe(true);
    expect(checkAnswer(question, "b").correct).toBe(true);
    expect(checkAnswer(question, "A").correct).toBe(false);
    expect(checkAnswer(question, null).correct).toBeNull();
  });

  it("checks true/false with boolean or string stored answers", () => {
    const boolQ = q({ question_type: "true_false", correct_answer: { value: true } });
    expect(checkAnswer(boolQ, true).correct).toBe(true);
    expect(checkAnswer(boolQ, false).correct).toBe(false);
    const strQ = q({ question_type: "true_false", correct_answer: { value: "False" } });
    expect(checkAnswer(strQ, false).correct).toBe(true);
  });

  it("checks numeric answers with tolerance and unit stripping", () => {
    const question = q({
      question_type: "numeric",
      correct_answer: { value: 9.8, tolerance: 0.1, unit: "m/s²" },
    });
    expect(checkAnswer(question, "9.8").correct).toBe(true);
    expect(checkAnswer(question, "9.84 m/s²").correct).toBe(true);
    // 9.9 is exactly at the tolerance boundary (inclusive) → correct;
    // 9.91 is outside → incorrect.
    expect(checkAnswer(question, "9.9").correct).toBe(true);
    expect(checkAnswer(question, "9.91").correct).toBe(false);
    expect(checkAnswer(question, "abc").correct).toBe(false);
  });

  it("scores short answers by keyword coverage", () => {
    const question = q({
      question_type: "short_answer",
      correct_answer: { keywords: ["momentum", "mass", "velocity"], threshold: 0.5 },
    });
    const hit = checkAnswer(question, "Momentum is mass times velocity.");
    expect(hit.correct).toBe(true);
    expect(hit.score).toBe(100);
    const partial = checkAnswer(question, "Momentum is a quantity of motion.");
    expect(partial.correct).toBe(false);
    expect(partial.score).toBe(Math.round((1 / 3) * 100));
  });

  it("checks matching and ordering", () => {
    const match = q({
      question_type: "matching",
      correct_answer: { pairs: [{ left: "H2O", right: "water" }, { left: "NaCl", right: "salt" }] },
    });
    expect(checkAnswer(match, { H2O: "water", NaCl: "salt" }).correct).toBe(true);
    expect(checkAnswer(match, { H2O: "water", NaCl: "sugar" }).score).toBe(50);

    const order = q({
      question_type: "ordering",
      correct_answer: { order: ["observe", "hypothesize", "test"] },
    });
    expect(checkAnswer(order, ["observe", "hypothesize", "test"]).correct).toBe(true);
    expect(checkAnswer(order, ["hypothesize", "observe", "test"]).score).toBe(33);
  });

  it("flags scenario questions without keywords for review", () => {
    const question = q({ question_type: "scenario" });
    const res = checkAnswer(question, "A farmer should...");
    expect(res.needsReview).toBe(true);
    expect(res.correct).toBeNull();

    const rubric = q({
      question_type: "scenario",
      correct_answer: { keywords: ["break-even", "fixed cost", "variable cost"] },
    });
    expect(checkAnswer(rubric, "Find the break-even point where fixed cost and variable cost meet.").correct).toBe(true);
  });
});
