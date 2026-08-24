// Learning Session assembly & unlock logic (pure functions).
//
// A topic becomes a structured session:
//   objectives → diagnostic → units (in sequence) → practice questions
//   (easy first) → application questions → practicals → assessment
//   → reflection (explain-back) → mastery evaluation.
//
// The diagnostic result shapes the run:
//   strong (>=75)  → fast-track: easy practice + re-explanation steps skipped
//   mid  (50-74)   → standard run, difficulty floor 2
//   weak (<50)     → difficulty floor 1, expanded hint budget (3 hints)

import type {
  LearningObjective,
  LearningUnit,
  Practical,
  Question,
  StepType,
} from "../types";

export interface PlanStep {
  number: number;
  stepType: StepType;
  title: string;
  /** unit-based step */
  unit?: LearningUnit;
  /** question-based step */
  question?: Question;
  /** practical-based step */
  practical?: Practical;
  /** generated steps carry a payload instead */
  objectives?: LearningObjective[];
  /** marked skipped when the diagnostic is strong */
  fastTrackEligible: boolean;
}

export interface SessionPlan {
  steps: PlanStep[];
  hasDiagnostic: boolean;
  estimatedMinutes: number;
}

const UNIT_TO_STEP: Record<LearningUnit["unit_type"], StepType> = {
  explanation: "explanation",
  definition: "definition",
  example: "example",
  worked_example: "worked_example",
  visual: "visual",
  formula: "explanation",
  case_study: "application",
  practice: "practice",
  application: "application",
  summary: "explanation",
  reflection: "reflection",
  video: "visual",
  reading: "explanation",
  interactive: "practice",
  practical: "practical",
  review: "practice",
};

export interface SessionPlanInput {
  topicName: string;
  units: LearningUnit[];
  questions: Question[];
  practicals: Practical[];
  objectives: LearningObjective[];
}

export function buildSessionPlan(input: SessionPlanInput): SessionPlan {
  const steps: PlanStep[] = [];
  let n = 0;
  const push = (s: Omit<PlanStep, "number" | "fastTrackEligible"> & { fastTrackEligible?: boolean }) =>
    steps.push({ number: ++n, ...s, fastTrackEligible: s.fastTrackEligible ?? false });

  // 1. Objectives — "what we are aiming for"
  const objectives = input.objectives
    .filter((o) => o.status !== "archived")
    .sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0));
  if (objectives.length) {
    push({ stepType: "objective", title: "Learning objectives", objectives });
  }

  // 2. Diagnostic (first approved diagnostic question, if any)
  const diagnostic = input.questions.find((q) => q.is_diagnostic && q.status === "approved");
  if (diagnostic) {
    push({ stepType: "diagnostic", title: "Diagnostic check", question: diagnostic });
  }

  // 3. Content units in curriculum sequence
  const units = [...input.units]
    .filter((u) => u.status !== "archived")
    .sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0));
  for (const u of units) {
    push({
      stepType: UNIT_TO_STEP[u.unit_type],
      title: u.title,
      unit: u,
      fastTrackEligible: u.unit_type === "explanation",
    });
  }

  // 4. Practice (difficulty 1-2) then application (3-5) questions.
  //    The hardest question is reserved for the final assessment so every
  //    question is answered exactly once.
  const practiceQuestions = input.questions
    .filter((q) => q.status === "approved" && !q.is_diagnostic)
    .sort((a, b) => a.difficulty - b.difficulty);
  const assessmentQuestion = practiceQuestions[practiceQuestions.length - 1];
  const pool = assessmentQuestion ? practiceQuestions.slice(0, -1) : [];
  const easy = pool.filter((q) => q.difficulty <= 2);
  const application = pool.filter((q) => q.difficulty >= 3);
  for (const q of easy) {
    push({ stepType: "practice", title: q.question_text.slice(0, 80), question: q, fastTrackEligible: true });
  }
  for (const q of application) {
    push({ stepType: "application", title: q.question_text.slice(0, 80), question: q });
  }

  // 5. Practicals
  for (const p of input.practicals) {
    push({ stepType: "practical", title: p.title, practical: p });
  }

  // 6. Assessment — the reserved hardest question
  if (assessmentQuestion) {
    push({ stepType: "assessment", title: "Assessment", question: assessmentQuestion });
  }

  // 7. Reflection (explain-back) — always offered
  push({ stepType: "reflection", title: "Explain it back" });

  // 8. Mastery evaluation — always last
  push({ stepType: "mastery", title: "Mastery evaluation" });

  const estimatedMinutes = steps.reduce((sum, s) => {
    if (s.unit) return sum + (s.unit.estimated_minutes ?? 10);
    if (s.question) return sum + 5;
    if (s.practical) return sum + 20;
    return sum + (s.stepType === "objective" ? 2 : s.stepType === "reflection" ? 8 : 3);
  }, 0);

  return { steps, hasDiagnostic: Boolean(diagnostic), estimatedMinutes };
}

// ---------------------------------------------------------------------------
// Diagnostic → run configuration
// ---------------------------------------------------------------------------

export interface DiagnosticOutcome {
  diagnosticScore: number;
  difficultyFloor: 1 | 2 | 3;
  hintBudget: number;
  fastTrack: boolean;
  summary: string;
}

export function applyDiagnosticScore(score: number): DiagnosticOutcome {
  if (score >= 75) {
    return {
      diagnosticScore: score,
      difficultyFloor: 2,
      hintBudget: 1,
      fastTrack: true,
      summary: "Strong foundation detected — easy items will be fast-tracked.",
    };
  }
  if (score >= 50) {
    return {
      diagnosticScore: score,
      difficultyFloor: 2,
      hintBudget: 2,
      fastTrack: false,
      summary: "You have a workable base. The session will build on it.",
    };
  }
  return {
    diagnosticScore: score,
    difficultyFloor: 1,
    hintBudget: 3,
    fastTrack: false,
    summary: "We'll start from the foundations and keep hints close at hand.",
  };
}

/** Which steps get skipped under a fast track (diagnostic >= 75). */
export function fastTrackSkippedSteps(plan: SessionPlan): Set<number> {
  const skipped = new Set<number>();
  for (const s of plan.steps) {
    if (s.fastTrackEligible) skipped.add(s.number);
  }
  return skipped;
}

// ---------------------------------------------------------------------------
// Unlock / progress
// ---------------------------------------------------------------------------

/**
 * The active step is the first step that is neither completed nor skipped.
 * Everything after it stays locked — progressive disclosure.
 */
export function activeStepNumber(
  plan: SessionPlan,
  completed: ReadonlySet<number>,
  skipped: ReadonlySet<number>,
): number {
  for (const s of plan.steps) {
    if (!completed.has(s.number) && !skipped.has(s.number)) return s.number;
  }
  return plan.steps.length + 1; // past the end → session complete
}

export function isSessionComplete(
  plan: SessionPlan,
  completed: ReadonlySet<number>,
  skipped: ReadonlySet<number>,
): boolean {
  return activeStepNumber(plan, completed, skipped) > plan.steps.length;
}

export function sessionProgress(
  plan: SessionPlan,
  completed: ReadonlySet<number>,
  skipped: ReadonlySet<number>,
): number {
  const countable = plan.steps.length;
  if (!countable) return 0;
  const done = plan.steps.filter((s) => completed.has(s.number) || skipped.has(s.number)).length;
  return Math.round((done / countable) * 100);
}
