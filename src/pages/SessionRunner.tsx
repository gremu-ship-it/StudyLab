// Learning Session runner — the structured DISCOVER→LEARN→PRACTICE→ASSESS
// experience with progressive step unlocking, diagnostic-adapted pacing,
// scaffolded questions, practicals, reflect-back and mastery evaluation.

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  CircleOff,
  Clock,
  FlaskConical,
  Lock,
  Lightbulb,
  PenLine,
  ShieldAlert,
  Target,
  Trophy,
} from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import { recordQuestionProgress, topicMasteryFor } from "../lib/progress";
import { applyDiagnosticScore } from "../lib/session";
import { type MasteryEstimate } from "../lib/mastery";
import { QuestionRunner, type AttemptResult } from "../components/QuestionRunner";
import { Button, Card, ErrorNote, MasteryBadge, Spinner } from "../components/ui";
import { Link, navigate } from "../router";
import type {
  LearningUnit,
  Practical,
  PracticalStep,
  Question,
  QuestionOption,
  SessionStep,
  StepType,
} from "../types";

// Steps a strong diagnostic fast-tracks.
const FAST_TRACK_TYPES: StepType[] = ["explanation", "practice", "definition", "example"];

const STEP_ICONS: Record<StepType, React.ReactNode> = {
  objective: <Target size={14} />,
  diagnostic: <CircleDot size={14} />,
  explanation: <Lightbulb size={14} />,
  definition: <PenLine size={14} />,
  example: <Lightbulb size={14} />,
  worked_example: <PenLine size={14} />,
  visual: <CircleDot size={14} />,
  practice: <Circle size={14} />,
  application: <CircleDot size={14} />,
  practical: <FlaskConical size={14} />,
  assessment: <ShieldAlert size={14} />,
  reflection: <PenLine size={14} />,
  mastery: <Trophy size={14} />,
};

export function SessionRunner({ sessionId }: { sessionId: string }) {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;

  const sessionQ = useQuery(() => api.getSession(sessionId), [sessionId]);
  const stepsQ = useQuery(() => api.getSessionSteps(sessionId), [sessionId]);

  const steps = useMemo(
    () => [...(stepsQ.data ?? [])].sort((a, b) => a.step_number - b.step_number),
    [stepsQ.data],
  );
  const unitIds = useMemo(() => steps.map((s) => s.learning_unit_id).filter((x): x is string => Boolean(x)), [steps]);
  const questionIds = useMemo(() => steps.map((s) => s.question_id).filter((x): x is string => Boolean(x)), [steps]);
  const practicalIds = useMemo(() => steps.map((s) => s.practical_id).filter((x): x is string => Boolean(x)), [steps]);

  const unitsQ = useQuery(() => api.getUnitsByIds(unitIds), [unitIds.join(",")]);
  const questionsQ = useQuery(() => api.getQuestionsByIds(questionIds), [questionIds.join(",")]);
  const optionsQ = useQuery(() => api.getQuestionOptions(questionIds), [questionIds.join(",")]);
  const practicalsQ = useQuery(() => api.getPracticalsByIds(practicalIds), [practicalIds.join(",")]);
  const practicalStepsQ = useQuery(() => api.getPracticalSteps(practicalIds), [practicalIds.join(",")]);
  const topicQ = useQuery(async () => {
    const s = sessionQ.data;
    return s ? api.getTopic(s.topic_id) : null;
  }, [sessionQ.data?.id]);

  // Completion state is tracked by step_number; seeded from the DB so a
  // student can resume exactly where they stopped.
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!stepsQ.data) return;
    setCompleted(new Set(stepsQ.data.filter((s) => s.status === "completed").map((s) => s.step_number)));
    setSkipped(new Set(stepsQ.data.filter((s) => s.status === "skipped").map((s) => s.step_number)));
    setHydrated(true);
  }, [stepsQ.data]);

  const session = sessionQ.data;
  const topic = topicQ.data;

  const lastNumber = steps.length ? steps[steps.length - 1].step_number : 0;
  const activeNumber =
    steps.find((s) => !completed.has(s.step_number) && !skipped.has(s.step_number))?.step_number ??
    lastNumber + 1;
  const done = activeNumber > lastNumber;
  const finishedCount = steps.filter((s) => completed.has(s.step_number) || skipped.has(s.step_number)).length;
  const pct = steps.length ? Math.round((finishedCount / steps.length) * 100) : 0;
  const hintBudget = Number((session?.settings as { hintBudget?: number } | null)?.hintBudget ?? 2);
  const activeStep = steps.find((s) => s.step_number === activeNumber) ?? null;

  if (sessionQ.loading || stepsQ.loading || unitsQ.loading || questionsQ.loading || optionsQ.loading || practicalsQ.loading) {
    return (
      <div className="page">
        <Spinner label="Loading your session…" />
      </div>
    );
  }
  if (sessionQ.error || stepsQ.error) {
    return (
      <div className="page">
        <ErrorNote message={sessionQ.error ?? stepsQ.error ?? ""} onRetry={() => { sessionQ.refresh(); stepsQ.refresh(); }} />
      </div>
    );
  }
  if (!session || !hydrated) return null;

  if (session.status === "completed") {
    return <CompletionView sessionId={session.id} />;
  }

  async function completeStep(step: SessionStep, score: number | null) {
    if (!user) return;
    try {
      await api.updateStep(step.id, {
        status: "completed",
        score,
        completed_at: new Date().toISOString(),
      });
      setCompleted((s) => new Set(s).add(step.step_number));
      await api.setSessionProgress(session!.id, { current_step: Math.max(session!.current_step, step.step_number) });
      stepsQ.refresh();
    } catch (e) {
      console.error("complete step failed", e);
    }
  }

  function skipFastTracked() {
    const eligible = steps.filter((s) => FAST_TRACK_TYPES.includes(s.step_type) && !completed.has(s.step_number));
    setSkipped((s) => new Set([...s, ...eligible.map((x) => x.step_number)]));
    void api
      .markStepsSkipped(eligible.map((x) => x.id))
      .then(() => stepsQ.refresh())
      .catch(() => {});
  }

  return (
    <div className="session">
      <aside className="session-side">
        <div className="session-side-head">
          <Link to={topic ? `/topics/${topic.id}` : "/"} className="back-link">
            <ChevronLeft size={14} /> {topic?.name ?? "Exit"}
          </Link>
          <div className="progress">
            <i style={{ width: `${pct}%` }} />
          </div>
          <span className="mut small">
            {pct}% complete · {steps.length - finishedCount} step{steps.length - finishedCount === 1 ? "" : "s"} left
          </span>
        </div>
        <ol className="step-list">
          {steps.map((s) => {
            const isDone = completed.has(s.step_number);
            const isSkip = skipped.has(s.step_number);
            const isActive = s.step_number === activeNumber && !done;
            const isLocked = !isActive && !isDone && !isSkip;
            return (
              <li
                key={s.id}
                className={`step-item ${isActive ? "active" : ""} ${isDone ? "done" : ""} ${isSkip ? "skip" : ""} ${isLocked ? "locked" : ""}`}
              >
                {isDone ? (
                  <CheckCircle2 size={15} />
                ) : isSkip ? (
                  <CircleOff size={15} />
                ) : isActive ? (
                  <CircleDot size={15} />
                ) : (
                  <Lock size={13} />
                )}
                <span className="step-label">
                  <small>{s.step_type.replace(/_/g, " ")}</small>
                  {s.title}
                </span>
              </li>
            );
          })}
        </ol>
      </aside>

      <main className="session-main">
        {activeStep ? (
          <StepBody
            key={activeStep.id}
            step={activeStep}
            unit={unitsQ.data?.find((u) => u.id === activeStep.learning_unit_id)}
            question={questionsQ.data?.find((q) => q.id === activeStep.question_id)}
            options={(optionsQ.data ?? []).filter((o) => o.question_id === activeStep.question_id)}
            practical={practicalsQ.data?.find((p) => p.id === activeStep.practical_id)}
            practicalSteps={(practicalStepsQ.data ?? []).filter((p) => p.practical_id === activeStep.practical_id)}
            hintBudget={hintBudget}
            topicName={topic?.name ?? ""}
            topicId={topic?.id}
            sessionId={session.id}
            userId={user?.id ?? ""}
            onComplete={(score, extra) => {
              if (extra?.diagnostic !== undefined && user) {
                const outcome = applyDiagnosticScore(extra.diagnostic);
                void api
                  .setSessionProgress(session.id, {
                    diagnostic_score: outcome.diagnosticScore,
                    difficulty_floor: outcome.difficultyFloor,
                    settings: { hintBudget: outcome.hintBudget, summary: outcome.summary },
                  })
                  .catch(() => {});
                if (outcome.fastTrack) skipFastTracked();
              }
              void completeStep(activeStep, score);
            }}
          />
        ) : (
          <EmptySession topicName={topic?.name ?? ""} />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StepBody(props: {
  step: SessionStep;
  unit?: LearningUnit;
  question?: Question;
  options: QuestionOption[];
  practical?: Practical;
  practicalSteps: PracticalStep[];
  hintBudget: number;
  topicName: string;
  topicId?: string;
  objectives?: { statement: string }[];
  sessionId: string;
  userId: string;
  onComplete: (score: number | null, extra?: { diagnostic?: number }) => void;
}) {
  const {
    step,
    unit,
    question,
    options,
    practical,
    practicalSteps,
    hintBudget,
    topicName,
    topicId,
    objectives,
    sessionId,
    userId,
    onComplete,
  } = props;
  const [attempts, setAttempts] = useState<AttemptResult[]>([]);
  const [unitRevealed, setUnitRevealed] = useState(step.step_type !== "worked_example");
  const objectivesQ = useQuery(
    async () => {
      const ids = (step.metadata as { objective_ids?: string[] })?.objective_ids;
      if (!ids?.length) return [];
      // objectives are small; fetch via first concept-less path: we stored ids
      // but the API is per-topic, so fetch from the step's topic via unit/question
      // Fallback: return statements via metadata when present.
      const meta = (step.metadata as { objective_statements?: string[] }).objective_statements;
      return meta ? meta.map((statement) => ({ statement })) : [];
    },
    [step.id],
  );

  function handleAttempt(r: AttemptResult) {
    setAttempts((a) => [...a, r]);
    if (question) void recordQuestionProgress({ userId, question, sessionId, result: r });
  }

  function bestScore(): number {
    if (!attempts.length) return 0;
    const graded = attempts.filter((a) => a.correct === true);
    if (graded.length) return 100;
    return Math.max(0, ...attempts.map((a) => a.score));
  }

  const diagnosticScore = useMemo(() => {
    if (step.step_type !== "diagnostic") return undefined;
    const graded = attempts.filter((a) => a.correct !== null);
    if (!graded.length) return undefined;
    return Math.round(graded.reduce((s, a) => s + a.score, 0) / graded.length);
  }, [attempts, step.step_type]);

  const resolvedObjectives = objectives ?? objectivesQ.data ?? undefined;

  switch (step.step_type) {
    case "objective":
      return (
        <Card className="step-card">
          <StepHeader icon={STEP_ICONS.objective} eyebrow="LEARNING OBJECTIVES" title="What this session aims for" />
          {resolvedObjectives && resolvedObjectives.length > 0 ? (
            <ul className="objective-list">
              {resolvedObjectives.map((o, i) => (
                <li key={i}>
                  <CheckCircle2 size={15} /> {o.statement}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">This topic has no recorded objectives yet — the session will still build understanding through its steps.</p>
          )}
          <div className="step-actions">
            <Button onClick={() => onComplete(null)}>Got it — begin <ChevronRight size={15} /></Button>
          </div>
        </Card>
      );

    case "explanation":
    case "definition":
    case "example":
    case "worked_example":
    case "visual":
      if (!unit) return <MissingContent />;
      return (
        <Card className="step-card">
          <StepHeader
            icon={STEP_ICONS[step.step_type]}
            eyebrow={step.step_type.replace(/_/g, " ").toUpperCase()}
            title={unit.title}
            source={unit.source_type === "student" ? "Your material" : "Course content"}
          />
          {unit.description && <p className="step-desc">{unit.description}</p>}
          {unit.formula && <code className="formula large">{unit.formula}</code>}
          {unit.body ? (
            step.step_type === "worked_example" && !unitRevealed ? (
              <div className="worked-hidden">
                <p className="muted">Work through it yourself first, then compare.</p>
                <Button variant="secondary" onClick={() => setUnitRevealed(true)}>
                  <Lightbulb size={14} /> Show the worked solution
                </Button>
              </div>
            ) : (
              <div className="unit-body">
                {splitLines(unit.body).map((l, i) =>
                  l.startsWith("#") ? <h4 key={i}>{l.replace(/^#+\s*/, "")}</h4> : <p key={i}>{l}</p>,
                )}
              </div>
            )
          ) : (
            <p className="muted">No written content for this unit yet.</p>
          )}
          {unit.estimated_minutes ? (
            <p className="mut small">
              <Clock size={12} /> ~{unit.estimated_minutes} min
            </p>
          ) : null}
          <div className="step-actions">
            <Button onClick={() => onComplete(null)}>
              {step.step_type === "worked_example" ? "I've worked it — continue" : "Continue"} <ChevronRight size={15} />
            </Button>
          </div>
        </Card>
      );

    case "practice":
    case "application":
    case "assessment":
    case "diagnostic":
      if (!question) return <MissingContent />;
      return (
        <Card className="step-card">
          <StepHeader
            icon={STEP_ICONS[step.step_type]}
            eyebrow={
              step.step_type === "diagnostic"
                ? "DIAGNOSTIC CHECK"
                : step.step_type === "assessment"
                  ? "ASSESSMENT — NO HINTS"
                  : step.step_type === "application"
                    ? "APPLICATION PROBLEM"
                    : "GUIDED PRACTICE"
            }
            title={
              step.step_type === "diagnostic"
                ? `Quick check: ${topicName}`
                : step.step_type === "assessment"
                  ? "Final check"
                  : undefined
            }
          />
          {step.step_type === "diagnostic" && (
            <p className="mut small">This calibrates the session — your score decides the pace. No penalty for getting it wrong.</p>
          )}
          {diagnosticScore !== undefined && step.step_type === "diagnostic" && (
            <div className={`diag-banner ${diagnosticScore >= 75 ? "good" : diagnosticScore >= 50 ? "mid" : "weak"}`}>
              <Target size={15} /> Diagnostic score: {diagnosticScore}% — {applyDiagnosticScore(diagnosticScore).summary}
            </div>
          )}
          <QuestionRunner
            question={question}
            options={options}
            hintBudget={step.step_type === "assessment" ? 0 : hintBudget}
            disableHints={step.step_type === "assessment"}
            onAttempt={handleAttempt}
            onComplete={() =>
              onComplete(
                bestScore(),
                step.step_type === "diagnostic" && diagnosticScore !== undefined ? { diagnostic: diagnosticScore } : undefined,
              )
            }
          />
        </Card>
      );

    case "practical":
      if (!practical) return <MissingContent />;
      return <PracticalRunner practical={practical} steps={practicalSteps} onDone={() => onComplete(100)} />;

    case "reflection":
      return <ReflectionStep topicName={topicName} userId={userId} topicId={topicId} onDone={(score) => onComplete(score)} />;

    case "mastery":
      return <MasteryStep sessionId={sessionId} userId={userId} topicId={topicId} onComplete={(score) => onComplete(score)} />;

    default:
      return <MissingContent />;
  }
}

function splitLines(body: string): string[] {
  return body
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function StepHeader({ icon, eyebrow, title, source }: { icon: React.ReactNode; eyebrow: string; title?: string; source?: string }) {
  return (
    <div className="step-head">
      <span className="step-icon">{icon}</span>
      <div>
        <span className="eyebrow">
          {eyebrow}
          {source ? ` · ${source}` : ""}
        </span>
        {title && <h2>{title}</h2>}
      </div>
    </div>
  );
}

function MissingContent() {
  return (
    <Card className="step-card">
      <p className="muted">This step's content is unavailable. Continue to the next step.</p>
    </Card>
  );
}

function EmptySession({ topicName }: { topicName: string }) {
  return (
    <Card className="step-card">
      <StepHeader icon={<Trophy size={16} />} eyebrow="SESSION COMPLETE" title={`You finished “${topicName}”`} />
      <p className="muted">All steps are done. Your mastery has been updated and a review is scheduled.</p>
      <div className="step-actions">
        <Button onClick={() => navigate("/")}>
          <Trophy size={15} /> Back to dashboard
        </Button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function PracticalRunner({ practical, steps, onDone }: { practical: Practical; steps: PracticalStep[]; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const [observations, setObservations] = useState<string[]>([]);
  const sorted = [...steps].sort((a, b) => a.step_number - b.step_number);
  const step = sorted[idx];

  return (
    <Card className="step-card">
      <StepHeader icon={STEP_ICONS.practical} eyebrow="PRACTICAL ACTIVITY" title={practical.title} />
      {practical.safety_notes && (
        <div className="safety">
          <ShieldAlert size={16} />
          <div>
            <strong>Safety</strong>
            <p>{practical.safety_notes}</p>
          </div>
        </div>
      )}
      {practical.objective && (
        <p className="step-desc">
          <strong>Aim:</strong> {practical.objective}
        </p>
      )}
      {practical.background && <p className="mut small">{practical.background}</p>}

      {step ? (
        <div className="practical-step">
          <span className="eyebrow">
            STEP {step.step_number} OF {sorted.length}
          </span>
          <h3>{step.instruction}</h3>
          {step.expected_action && (
            <p className="mut small">
              <strong>Expected action:</strong> {step.expected_action}
            </p>
          )}
          {step.observation_prompt && (
            <label className="field">
              <span>{step.observation_prompt}</span>
              <textarea
                rows={3}
                value={observations[idx] ?? ""}
                onChange={(e) => setObservations((o) => o.map((x, i) => (i === idx ? e.target.value : x)))}
                placeholder="What did you observe?"
              />
            </label>
          )}
          <div className="step-actions">
            {idx > 0 && (
              <Button variant="secondary" onClick={() => setIdx(idx - 1)}>
                <ChevronLeft size={14} /> Previous
              </Button>
            )}
            {idx < sorted.length - 1 ? (
              <Button onClick={() => setIdx(idx + 1)}>
                Done — next step <ChevronRight size={14} />
              </Button>
            ) : (
              <Button onClick={onDone}>
                <CheckCircle2 size={15} /> Complete practical
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <p className="muted">No recorded procedure — complete the activity using your lab manual, then finish.</p>
          {practical.expected_outcome && (
            <p className="mut small">
              <strong>Expected outcome:</strong> {practical.expected_outcome}
            </p>
          )}
          <div className="step-actions">
            <Button onClick={onDone}>
              <CheckCircle2 size={15} /> Complete practical
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function ReflectionStep({
  topicName,
  userId,
  topicId,
  onDone,
}: {
  topicName: string;
  userId: string;
  topicId?: string;
  onDone: (score: number | null) => void;
}) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!text.trim() || saved) return;
    setError(null);
    try {
      await api.addExplainBackAttempt({
        student_id: userId,
        topic_id: topicId ?? null,
        concept_id: null,
        prompt: `Explain “${topicName}” in your own words, as if teaching a peer.`,
        student_response: text.trim(),
        ai_feedback: null,
        score: null,
      });
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card className="step-card">
      <StepHeader icon={STEP_ICONS.reflection} eyebrow="EXPLAIN-BACK (FEYNMAN MODE)" title={`Teach “${topicName}” to an imaginary peer`} />
      <p className="mut small">
        Write your explanation in your own words. If the AI tutor is configured it will grade conceptual correctness,
        missing ideas, misconceptions, clarity and application. Until then your answer is stored for review and counts
        toward completing the session.
      </p>
      <label className="field">
        <span>Your explanation</span>
        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="In my own words, this is…"
        />
      </label>
      {error && <ErrorNote message={error} />}
      {saved && (
        <div className="scaffold solved">
          <CheckCircle2 size={16} />
          <div>
            <strong>Saved.</strong>
            <p>Your explanation is recorded. Try saying the key idea out loud — where you stumble is where the gap is.</p>
          </div>
        </div>
      )}
      <div className="step-actions">
        {!saved ? (
          <Button onClick={submit} disabled={!text.trim()}>
            Save explanation
          </Button>
        ) : (
          <Button onClick={() => onDone(null)}>
            Continue <ChevronRight size={14} />
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function MasteryStep({
  sessionId,
  userId,
  topicId,
  onComplete,
}: {
  sessionId: string;
  userId: string;
  topicId?: string;
  onComplete: (score: number | null) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState<MasteryEstimate | null>(null);
  const [resolvedTopicId, setResolvedTopicId] = useState<string | null>(topicId ?? null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let tid = topicId ?? null;
        if (!tid) {
          const session = await api.getSession(sessionId);
          if (session) tid = session.topic_id;
        }
        setResolvedTopicId(tid);
        if (tid) {
          const est = await topicMasteryFor(userId, tid);
          if (alive) setEstimate(est);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, sessionId, topicId]);

  async function finish() {
    if (!resolvedTopicId) return;
    setDone(true);
    try {
      await api.setSessionProgress(sessionId, { status: "completed", completed_at: new Date().toISOString() });
    } catch (e) {
      console.error(e);
    }
    onComplete(estimate?.score ?? null);
  }

  if (loading)
    return (
      <Card className="step-card">
        <Spinner label="Computing your mastery…" />
      </Card>
    );

  return (
    <Card className="step-card">
      <StepHeader icon={STEP_ICONS.mastery} eyebrow="MASTERY EVALUATION" title="How this topic stands now" />
      {estimate && estimate.attempts > 0 ? (
        <div className="mastery-summary">
          <MasteryBadge level={estimate.level} score={estimate.score} />
          <div>
            <p className="muted">
              {estimate.attempts} attempt{estimate.attempts === 1 ? "" : "s"} counted · confidence {estimate.confidence}%
              {estimate.easyAccuracy !== null && ` · basics ${estimate.easyAccuracy}%`}
              {estimate.applicationAccuracy !== null && ` · application ${estimate.applicationAccuracy}%`}
            </p>
            {estimate.applicationGap ? (
              <p className="gap-note">
                <Target size={14} /> You're strong on the basics but application items still trip you up — the dashboard
                will recommend application practice before marking this topic mastered.
              </p>
            ) : (
              <p className="gap-note good">
                <CheckCircle2 size={14} /> A spaced-repetition review is scheduled from today.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="muted">No graded attempts yet in this session — mastery stays at “not assessed”.</p>
      )}
      <div className="step-actions">
        {!done ? (
          <Button onClick={finish}>
            <Trophy size={15} /> Finish session
          </Button>
        ) : (
          <Button onClick={() => navigate("/")}>
            <Trophy size={15} /> Back to dashboard
          </Button>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------

function CompletionView({ sessionId }: { sessionId: string }) {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  const sessionQ = useQuery(() => api.getSession(sessionId), [sessionId]);
  const topicQ = useQuery(async () => {
    const s = sessionQ.data;
    return s ? api.getTopic(s.topic_id) : null;
  }, [sessionQ.data?.id]);
  const masteryQ = useQuery(async () => {
    const s = sessionQ.data;
    if (!s || !user) return null;
    return topicMasteryFor(user.id, s.topic_id);
  }, [sessionQ.data?.id, user?.id]);

  if (sessionQ.loading || topicQ.loading || masteryQ.loading)
    return (
      <div className="page">
        <Spinner label="Loading summary…" />
      </div>
    );
  const est = masteryQ.data;
  return (
    <section className="page">
      <Card className="completion-card">
        <div className="completion-icon">
          <Trophy size={30} />
        </div>
        <span className="eyebrow">SESSION COMPLETE</span>
        <h1>{topicQ.data?.name ?? "Topic"}</h1>
        {est && est.attempts > 0 ? (
          <div className="mastery-summary">
            <MasteryBadge level={est.level} score={est.score} />
            <p className="muted">
              {est.attempts} attempts · confidence {est.confidence}%
              {est.applicationGap ? " · application practice recommended" : " · review scheduled"}
            </p>
          </div>
        ) : (
          <p className="muted">You completed the session. Once graded attempts exist, mastery is estimated from them.</p>
        )}
        <div className="hero-actions">
          <Button onClick={() => navigate("/")}>Back to dashboard</Button>
          {topicQ.data && (
            <Button variant="secondary" onClick={() => navigate(`/topics/${topicQ.data!.id}`)}>
              Back to topic
            </Button>
          )}
        </div>
      </Card>
    </section>
  );
}
