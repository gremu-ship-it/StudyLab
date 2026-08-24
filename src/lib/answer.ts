// Deterministic answer checking for all supported question types.
// Pure functions only — no DOM, no supabase — so it is unit-testable.
//
// correct_answer JSONB shapes per question_type:
//   multiple_choice { option_key: "B" }
//   true_false      { value: true }
//   numeric         { value: 12.5, tolerance?: 0.1, unit?: string }
//   short_answer    { keywords: ["momentum", ...], threshold?: 0.5 }
//   matching        { pairs: [{ left, right }] }
//   ordering        { order: ["step1", "step2"] }
//   scenario        { keywords?: [...] }  // no keywords => needs human/AI review

import type { Question, QuestionType } from "../types";

export interface CheckResult {
  /** null when the answer cannot be auto-graded (scenario without keywords). */
  correct: boolean | null;
  /** 0..100; 0 when not auto-gradable. */
  score: number;
  /** Human-readable feedback for the student. */
  feedback: string;
  needsReview: boolean;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/,/g, "").replace(/[^0-9eE+\-.\s]/g, " ");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : null;
}

export function checkAnswer(question: Pick<Question, "question_type" | "correct_answer">, answer: unknown): CheckResult {
  switch (question.question_type) {
    case "multiple_choice":
      return checkMultipleChoice(question, answer);
    case "true_false":
      return checkTrueFalse(question, answer);
    case "numeric":
      return checkNumeric(question, answer);
    case "short_answer":
      return checkShortAnswer(question, answer);
    case "matching":
      return checkMatching(question, answer);
    case "ordering":
      return checkOrdering(question, answer);
    case "scenario":
      return checkScenario(question, answer);
    default:
      return { correct: null, score: 0, feedback: "Unknown question type.", needsReview: true };
  }
}

function checkMultipleChoice(question: Pick<Question, "question_type" | "correct_answer">, answer: unknown): CheckResult {
  const expected = (question.correct_answer as { option_key?: string })?.option_key;
  if (typeof answer !== "string" || !expected) {
    return { correct: null, score: 0, feedback: "No answer recorded.", needsReview: false };
  }
  const ok = answer.toUpperCase() === expected.toUpperCase();
  return {
    correct: ok,
    score: ok ? 100 : 0,
    feedback: ok ? "Correct." : `Incorrect — the expected answer was ${expected}.`,
    needsReview: false,
  };
}

function checkTrueFalse(question: Pick<Question, "question_type" | "correct_answer">, answer: unknown): CheckResult {
  const raw = (question.correct_answer as { value?: unknown })?.value;
  const expected = typeof raw === "boolean" ? raw : raw === "true" || raw === "True";
  if (answer !== true && answer !== false) {
    return { correct: null, score: 0, feedback: "No answer recorded.", needsReview: false };
  }
  const ok = answer === expected;
  return {
    correct: ok,
    score: ok ? 100 : 0,
    feedback: ok ? "Correct." : `Incorrect — the correct statement is ${expected ? "True" : "False"}.`,
    needsReview: false,
  };
}

function checkNumeric(question: Pick<Question, "question_type" | "correct_answer">, answer: unknown): CheckResult {
  const ca = question.correct_answer as { value?: number; tolerance?: number; unit?: string };
  if (typeof ca?.value !== "number") {
    return { correct: null, score: 0, feedback: "Question has no numeric answer configured.", needsReview: true };
  }
  const given = parseNumber(answer);
  if (given === null) {
    return { correct: false, score: 0, feedback: "Please enter a numeric answer.", needsReview: false };
  }
  const tolerance = ca.tolerance ?? 0.01;
  // +1e-9 guards against floating-point boundaries (9.9-9.8 = 0.0999...964)
  const ok = Math.abs(given - ca.value) <= tolerance + 1e-9;
  const unit = ca.unit ? ` ${ca.unit}` : "";
  return {
    correct: ok,
    score: ok ? 100 : 0,
    feedback: ok
      ? `Correct — ${ca.value}${unit}.`
      : `Not quite. Keep working — the target is within ±${tolerance}${unit}.`,
    needsReview: false,
  };
}

function checkShortAnswer(question: Pick<Question, "question_type" | "correct_answer">, answer: unknown): CheckResult {
  const ca = question.correct_answer as { keywords?: string[]; threshold?: number };
  const keywords = ca?.keywords ?? [];
  if (!keywords.length) {
    return { correct: null, score: 0, feedback: "This answer needs review.", needsReview: true };
  }
  if (typeof answer !== "string") {
    return { correct: false, score: 0, feedback: "Please write your answer in words.", needsReview: false };
  }
  const text = norm(answer);
  const hits = keywords.filter((k) => text.includes(norm(k))).length;
  const fraction = hits / keywords.length;
  const threshold = ca.threshold ?? 0.5;
  const ok = fraction >= threshold;
  return {
    correct: ok,
    score: Math.round(fraction * 100),
    feedback: ok
      ? `Good answer — ${hits}/${keywords.length} key ideas present.`
      : `You covered ${hits}/${keywords.length} key ideas. Compare with the explanation and try again.`,
    needsReview: false,
  };
}

function checkMatching(question: Pick<Question, "question_type" | "correct_answer">, answer: unknown): CheckResult {
  const ca = question.correct_answer as { pairs?: { left: string; right: string }[] };
  const pairs = ca?.pairs ?? [];
  if (!pairs.length) {
    return { correct: null, score: 0, feedback: "Question has no pairs configured.", needsReview: true };
  }
  if (typeof answer !== "object" || answer === null) {
    return { correct: false, score: 0, feedback: "Please complete all matches.", needsReview: false };
  }
  const given = answer as Record<string, string>;
  let hits = 0;
  for (const p of pairs) {
    if (norm(given[p.left] ?? "") === norm(p.right)) hits++;
  }
  const fraction = hits / pairs.length;
  return {
    correct: fraction === 1,
    score: Math.round(fraction * 100),
    feedback: fraction === 1 ? "All matches correct." : `${hits}/${pairs.length} matches correct.`,
    needsReview: false,
  };
}

function checkOrdering(question: Pick<Question, "question_type" | "correct_answer">, answer: unknown): CheckResult {
  const ca = question.correct_answer as { order?: string[] };
  const expected = ca?.order ?? [];
  if (!expected.length) {
    return { correct: null, score: 0, feedback: "Question has no order configured.", needsReview: true };
  }
  if (!Array.isArray(answer)) {
    return { correct: false, score: 0, feedback: "Please put all items in order.", needsReview: false };
  }
  let hits = 0;
  expected.forEach((item, i) => {
    if (answer[i] === item) hits++;
  });
  const fraction = hits / expected.length;
  return {
    correct: fraction === 1,
    score: Math.round(fraction * 100),
    feedback: fraction === 1 ? "Correct order." : `${hits}/${expected.length} items in the right position.`,
    needsReview: false,
  };
}

function checkScenario(question: Pick<Question, "question_type" | "correct_answer">, answer: unknown): CheckResult {
  const ca = question.correct_answer as { keywords?: string[]; threshold?: number };
  if (typeof answer !== "string" || !answer.trim()) {
    return { correct: null, score: 0, feedback: "Please write your answer.", needsReview: true };
  }
  const keywords = ca?.keywords ?? [];
  if (!keywords.length) {
    // Application/case questions without rubric keywords require AI or human review.
    return { correct: null, score: 0, feedback: "Answer recorded — it will be reviewed.", needsReview: true };
  }
  const text = norm(answer);
  const hits = keywords.filter((k) => text.includes(norm(k))).length;
  const fraction = hits / keywords.length;
  const threshold = ca.threshold ?? 0.5;
  const ok = fraction >= threshold;
  return {
    correct: ok,
    score: Math.round(fraction * 100),
    feedback: ok ? "Good application — the key elements are present." : "Part of the reasoning is missing — see the explanation.",
    needsReview: !ok && fraction < 0.5,
  };
}

export type { QuestionType };
