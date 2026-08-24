// Course workspace tabs added in phases 5 + 9:
//   Practice     — work the course question bank with full scaffolding
//   Assessments  — author assessments, sit them (no hints), review results
//   Practicals   — course practicals + deterministic guided quick-activities

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FlaskConical,
  History,
  ListChecks,
  PlayCircle,
  Plus,
  ShieldAlert,
  Target,
  Trophy,
  XCircle,
} from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Modal,
  Select,
  SectionHead,
  Spinner,
} from "../components/ui";
import { QuestionRunner, type AttemptResult } from "../components/QuestionRunner";
import { ActivityRunner } from "../components/ActivityRunner";
import { ACTIVITY_REGISTRY, listActivities } from "../lib/practical-activities";
import { recordQuestionProgress } from "../lib/progress";
import type {
  Assessment,
  AssessmentAttempt,
  Practical,
  PracticalStep,
  Question,
  QuestionOption,
  QuestionResult,
  Topic,
} from "../types";

// ---------------------------------------------------------------------------
// shared: questions available in this course (approved + own drafts)
// ---------------------------------------------------------------------------

function useCourseQuestionBank(courseId: string) {
  const topicsQ = useQuery(() => api.getTopics(courseId), [courseId]);
  const user = useUserId();
  const bankQ = useQuery(async () => {
    const topics = topicsQ.data ?? [];
    if (!topics.length) return { questions: [] as Question[], options: [] as QuestionOption[] };
    const all: Question[] = [];
    for (const t of topics) {
      const qs = await api.getQuestions(t.id, { includeOwnDrafts: true, userId: user ?? undefined });
      all.push(...qs);
    }
    const opts = all.length ? await api.getQuestionOptions(all.map((q) => q.id)) : [];
    return { questions: all, options: opts };
  }, [(topicsQ.data ?? []).map((t) => t.id).join(","), user]);
  return { topicsQ, bankQ };
}

function useUserId(): string | null {
  const { state } = useAuth();
  return state.status === "ready" ? state.user.id : null;
}

const DIFF_LABEL = ["", "very easy", "easy", "moderate", "hard", "very hard"];

// ---------------------------------------------------------------------------
// PRACTICE TAB
// ---------------------------------------------------------------------------

export function PracticeTab({ course }: { course: { id: string; name: string } }) {
  const user = useUserId();
  const { topicsQ, bankQ } = useCourseQuestionBank(course.id);
  const [topicId, setTopicId] = useState<string>("");
  const [activeQ, setActiveQ] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const questions = useMemo(
    () => (bankQ.data?.questions ?? []).filter((q) => q.topic_id === (topicId || q.topic_id)),
    [bankQ.data, topicId],
  );
  const options = bankQ.data?.options ?? [];
  const attemptsQ = useQuery(
    async () => {
      type Att = { count: number; last: { correct: boolean | null; score: number | null } | null };
      const ids = questions.map((q) => q.id);
      if (!ids.length) return new Map<string, Att>();
      const rows = await api.getAttemptsForQuestions(ids);
      const m = new Map<string, Att>();
      for (const r of rows) {
        const cur = m.get(r.question_id) ?? { count: 0, last: null };
        cur.count += 1;
        if (!cur.last) cur.last = { correct: r.is_correct, score: r.score };
        m.set(r.question_id, cur);
      }
      return m;
    },
    [questions.map((q) => q.id).join(",")],
  );

  if (topicsQ.loading || bankQ.loading) return <Spinner label="Loading practice bank…" />;
  const topics = topicsQ.data ?? [];

  async function onAttemptComplete(q: Question, r: AttemptResult) {
    if (!user) return;
    try {
      await recordQuestionProgress({ userId: user, question: q, sessionId: null, result: r });
      attemptsQ.refresh();
      setFeedback(
        r.correct
          ? `Correct — ${Math.round(r.score)}% on this attempt. Mastery and review schedule updated.`
          : `Not this time — review the worked solution above, then try the next question.`,
      );
    } catch (e) {
      setFeedback(`Attempt recorded locally but save failed: ${e instanceof Error ? e.message : e}`);
    }
    setActiveQ(null);
  }

  return (
    <div>
      <SectionHead
        title="Practice"
        sub="Work this course's question bank — full scaffold (attempt → hint → guiding question → partial help → reveal), no pass/fail"
      />
      {topics.length === 0 || (bankQ.data?.questions.length ?? 0) === 0 ? (
        <Empty
          icon={<Target size={36} />}
          title="Nothing to practise yet"
          body={
            topics.length === 0
              ? "Add a topic first — then questions you or your lecturer add become practice material."
              : "Add questions to a topic (Topics tab → open topic) and they appear here immediately, including your own drafts."
          }
        />
      ) : activeQ ? (
        <Card className="practice-active">
          <div className="step-head">
            <span className="step-icon"><Target size={15} /></span>
            <div>
              <span className="eyebrow">PRACTICE · NO HARM — HINTS AVAILABLE</span>
              <h2>
                {activeQ.question_type.replace("_", " ")} · difficulty {activeQ.difficulty}/5
              </h2>
            </div>
          </div>
          <QuestionRunner
            key={activeQ.id}
            question={activeQ}
            options={options.filter((o) => o.question_id === activeQ.id)}
            hintBudget={2}
            onComplete={(r) => onAttemptComplete(activeQ, r)}
          />
          {feedback && <p className="muted practice-note">{feedback}</p>}
          <div className="step-actions">
            <Button variant="secondary" onClick={() => { setActiveQ(null); setFeedback(null); }}>
              Back to question list
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {topics.length > 1 && (
            <div className="practice-filter">
              <Select
                label="Topic"
                value={topicId}
                onChange={setTopicId}
                options={[
                  { value: "", label: `All topics (${bankQ.data?.questions.length ?? 0} questions)` },
                  ...topics.map((t) => ({
                    value: t.id,
                    label: `${t.name} (${(bankQ.data?.questions ?? []).filter((q) => q.topic_id === t.id).length})`,
                  })),
                ]}
              />
            </div>
          )}
          <div className="qbank-list">
            {questions
              .slice()
              .sort((a, b) => a.difficulty - b.difficulty || a.question_text.localeCompare(b.question_text))
              .map((q) => {
                const att = attemptsQ.data?.get(q.id);
                return (
                  <Card key={q.id} className="qbank-row">
                    <div className="topic-main">
                      <div className="topic-title-line">
                        <span className={`diff diff-${q.difficulty}`}>{DIFF_LABEL[q.difficulty]}</span>
                        <h3>{q.question_text}</h3>
                      </div>
                      <div className="topic-meta">
                        <span>{q.question_type.replace("_", " ")}</span>
                        <span>{topics.find((t) => t.id === q.topic_id)?.name ?? "topic"}</span>
                        {att ? (
                          <span>
                            {att.count} attempt{att.count === 1 ? "" : "s"}
                            {att.last?.correct === true ? " · last: correct" : att.last?.correct === false ? " · last: missed" : ""}
                          </span>
                        ) : (
                          <span>not attempted</span>
                        )}
                      </div>
                    </div>
                    <Button onClick={() => { setActiveQ(q); setFeedback(null); }}>
                      <PlayCircle size={15} /> Practise
                    </Button>
                  </Card>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ASSESSMENTS TAB
// ---------------------------------------------------------------------------

export function AssessmentsTab({ course }: { course: { id: string; name: string } }) {
  const user = useUserId();
  const { topicsQ, bankQ } = useCourseQuestionBank(course.id);
  const assessmentsQ = useQuery(() => api.getAssessments(course.id), [course.id]);
  const [showCreate, setShowCreate] = useState(false);
  const [running, setRunning] = useState<{
    assessment: Assessment;
    questions: Question[];
    options: QuestionOption[];
    attempt: AssessmentAttempt | null;
    idx: number;
    results: QuestionResult[];
    error: string | null;
  } | null>(null);
  const [done, setDone] = useState<{
    attempt: AssessmentAttempt | null;
    title: string;
    passPercent: number;
    score: number;
    passed: boolean;
    results: QuestionResult[];
    warning: string | null;
  } | null>(null);

  if (assessmentsQ.loading || bankQ.loading) return <Spinner label="Loading assessments…" />;
  if (assessmentsQ.error) return <ErrorNote message={assessmentsQ.error} onRetry={assessmentsQ.refresh} />;
  const assessments = assessmentsQ.data ?? [];
  const topics = topicsQ.data ?? [];
  const bank = bankQ.data?.questions ?? [];

  async function startAttempt(a: Assessment) {
    if (!user) return;
    const qs = (bankQ.data?.questions ?? []).filter((q) => a.question_ids.includes(q.id));
    if (!qs.length) {
      setRunning({
        assessment: a,
        questions: [],
        options: [],
        attempt: null,
        idx: 0,
        results: [],
        error: "This assessment has no answerable questions yet.",
      });
      return;
    }
    try {
      const attempt = await api.startAssessmentAttempt({ student_id: user, assessment_id: a.id });
      setRunning({
        assessment: a,
        questions: qs,
        options: bankQ.data?.options ?? [],
        attempt,
        idx: 0,
        results: [],
        error: null,
      });
      setDone(null);
    } catch (e) {
      setRunning({
        assessment: a,
        questions: qs,
        options: [],
        attempt: null,
        idx: 0,
        results: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function onQuestionComplete(q: Question, r: AttemptResult) {
    if (!running) return;
    const result: QuestionResult = {
      question_id: q.id,
      score: Math.round(r.score),
      correct: r.correct,
      hints_used: r.hintsUsed,
      time_seconds: r.timeSeconds,
      answer: r.answer,
    };
    const results = [...running.results, result];
    const nextIdx = running.idx + 1;
    if (nextIdx < running.questions.length) {
      setRunning({ ...running, results, idx: nextIdx });
      return;
    }
    // finished — grade and persist
    const score = Math.round(results.reduce((s, x) => s + x.score, 0) / Math.max(1, results.length));
    const passPercent = running.assessment.pass_percent ?? 70;
    const passed = score >= passPercent;
    let attempt = running.attempt;
    let warning: string | null = null;
    try {
      if (!attempt && user) {
        attempt = await api.startAssessmentAttempt({ student_id: user, assessment_id: running.assessment.id });
      }
      if (attempt) {
        await api.submitAssessmentAttempt(attempt.id, {
          submitted_at: new Date().toISOString(),
          score,
          passed,
          question_results: results,
        });
      }
    } catch (e) {
      warning = `Your answers are shown below, but saving the result failed: ${e instanceof Error ? e.message : e}`;
    }
    setRunning(null);
    setDone({
      attempt,
      title: running.assessment.title,
      passPercent,
      score,
      passed,
      results,
      warning,
    });
    assessmentsQ.refresh();
  }

  // ---------- running view ----------
  if (running) {
    if (running.error && !running.questions.length) {
      return (
        <div>
          <SectionHead title="Assessment" sub={running.assessment.title} />
          <ErrorNote message={running.error} onRetry={() => setRunning(null)} />
        </div>
      );
    }
    const q = running.questions[running.idx];
    return (
      <div>
        <SectionHead
          title={running.assessment.title}
          sub={`Question ${running.idx + 1} of ${running.questions.length} · pass mark ${running.assessment.pass_percent}% · no hints — this is the real thing`}
        />
        <div className="assess-progress">
          {running.questions.map((x, i) => (
            <span key={x.id} className={`assess-dot ${i < running.idx ? "done" : i === running.idx ? "now" : ""}`} />
          ))}
        </div>
        {q && (
          <QuestionRunner
            key={q.id}
            question={q}
            options={running.options.filter((o) => o.question_id === q.id)}
            hintBudget={0}
            disableHints
            onComplete={(r) => onQuestionComplete(q, r)}
          />
        )}
        <div className="step-actions">
          <Button variant="secondary" onClick={() => setRunning(null)}>
            Quit attempt (progress is not saved)
          </Button>
        </div>
      </div>
    );
  }

  // ---------- results view ----------
  if (done) {
    const total = done.results.length;
    const correctCount = done.results.filter((r) => r.correct).length;
    return (
      <div>
        <SectionHead title="Assessment result" sub={done.title} />
        {done.warning && <ErrorNote message={done.warning} />}
        <Card className={`result-banner ${done.passed ? "pass" : "fail"}`}>
          {done.passed ? <Trophy size={22} /> : <XCircle size={22} />}
          <div>
            <h2>{done.passed ? "Passed" : "Not yet — review and retake"}</h2>
            <p>
              Score {done.score} / 100 · pass mark {done.passPercent}% · {correctCount}/{total} questions correct ·{" "}
              {done.results.reduce((s, r) => s + (r.hints_used ?? 0), 0)} hints used
            </p>
            {!done.passed && (
              <p className="muted small">
                The mastery engine separates easy items from application items — a high score on easy items alone does not count as mastery.
              </p>
            )}
          </div>
        </Card>
        <div className="qbank-list">
          {done.results.map((r, i) => (
            <Card key={i} className={`qbank-row result-row ${r.correct ? "ok" : "no"}`}>
              <div className="topic-main">
                <div className="topic-title-line">
                  {r.correct ? <CheckCircle2 size={16} /> : <XCircle size={16} className="mut" />}
                  <h3>Question {i + 1} — {Math.round(r.score)}%</h3>
                </div>
                <div className="topic-meta">
                  <span>{r.time_seconds != null ? `${r.time_seconds}s` : "no timing"}</span>
                  <span>{r.hints_used} hint{r.hints_used === 1 ? "" : "s"}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <div className="step-actions">
          <Button variant="secondary" onClick={() => setDone(null)}>
            Back to assessments
          </Button>
        </div>
      </div>
    );
  }

  // ---------- list view ----------
  return (
    <div>
      <SectionHead
        title="Assessments"
        sub="Formal checks: no hints, scored, pass mark applied. Your own drafts are available in test mode."
        action={
          <Button onClick={() => setShowCreate(true)} disabled={!bank.length}>
            <Plus size={15} /> Create assessment
          </Button>
        }
      />
      {assessments.length === 0 ? (
        <Empty
          icon={<ClipboardCheck size={36} />}
          title="No assessments yet"
          body={
            bank.length
              ? "Create one from the question bank: pick the questions, set a pass mark, and it's ready to sit."
              : "Add questions to this course's topics first — an assessment is a titled set of bank questions with a pass mark."
          }
          actions={
            bank.length ? (
              <Button onClick={() => setShowCreate(true)}>
                <Plus size={15} /> Create first assessment
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="qbank-list">
          {assessments.map((a) => (
            <AssessmentCard
              key={a.id}
              a={a}
              isMine={a.created_by === user}
              questionCount={a.question_ids.length}
              onStart={() => startAttempt(a)}
              onPublished={assessmentsQ.refresh}
            />
          ))}
        </div>
      )}
      {showCreate && (
        <CreateAssessmentModal
          course={course}
          topics={topics}
          bank={bank}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            assessmentsQ.refresh();
          }}
        />
      )}
    </div>
  );
}

function AssessmentCard({
  a,
  isMine,
  questionCount,
  onStart,
  onPublished,
}: {
  a: Assessment;
  isMine: boolean;
  questionCount: number;
  onStart: () => void;
  onPublished: () => void;
}) {
  const [publishing, setPublishing] = useState(false);

  async function publish() {
    if (!isMine || a.status === "approved") return;
    setPublishing(true);
    try {
      await api.updateAssessment(a.id, { status: "approved" });
      onPublished();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Card className="qbank-row">
      <div className="topic-main">
        <div className="topic-title-line">
          <h3>{a.title}</h3>
          <span className={`tag ${a.status === "approved" ? "tag-green" : "tag-amber"}`}>{a.status}</span>
        </div>
        {a.description && <p className="mut small">{a.description}</p>}
        <div className="topic-meta">
          <span>{questionCount} questions</span>
          <span>pass ≥ {a.pass_percent}%</span>
          {a.time_limit_seconds ? <span>limit {Math.round(a.time_limit_seconds / 60)} min</span> : <span>untimed</span>}
          {isMine && <span>your assessment</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {isMine && a.status !== "approved" && (
          <Button variant="secondary" onClick={publish} disabled={publishing}>
            {publishing ? "Publishing…" : "Publish"}
          </Button>
        )}
        <Button onClick={onStart}>
          <PlayCircle size={15} /> {isMine && a.status !== "approved" ? "Test draft" : "Start attempt"}
        </Button>
      </div>
    </Card>
  );
}

function CreateAssessmentModal({
  course,
  topics,
  bank,
  onClose,
  onSaved,
}: {
  course: { id: string; name: string };
  topics: Topic[];
  bank: Question[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const user = useUserId();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [topicId, setTopicId] = useState("");
  const [passPercent, setPassPercent] = useState("70");
  const [timeLimit, setTimeLimit] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const candidates = bank.slice().sort((a, b) => a.difficulty - b.difficulty || a.question_text.localeCompare(b.question_text));

  async function save() {
    if (!user) return;
    setError(null);
    if (!title.trim()) return setError("Give the assessment a title.");
    if (picked.length < 1) return setError("Pick at least one question.");
    setBusy(true);
    try {
      await api.createAssessment({
        course_id: course.id,
        topic_id: topicId || null,
        title: title.trim(),
        description: desc.trim() || null,
        question_ids: picked,
        pass_percent: Math.min(100, Math.max(0, Number(passPercent) || 70)),
        time_limit_seconds: timeLimit ? Number(timeLimit) * 60 : null,
        status: "draft",
        created_by: user,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Create an assessment" eyebrow="ASSESSMENT ENGINE" onClose={onClose} wide>
      <p className="muted">
        An assessment is a titled, scored set of questions from this course's bank. It starts as a draft you can
        test; hit **Publish** and it becomes visible to everyone (others only ever see published assessments).
      </p>
      <Field label="Title" value={title} onChange={setTitle} placeholder={`e.g. ${course.name} — midpoint check`} />
      <Field label="Description (optional)" value={desc} onChange={setDesc} rows={2} />
      <div className="field-row">
        <Select
          label="Topic (optional)"
          value={topicId}
          onChange={setTopicId}
          options={[{ value: "", label: "Whole course" }, ...topics.map((t) => ({ value: t.id, label: t.name }))]}
        />
        <div className="field-row">
          <Field label="Pass mark %" value={passPercent} onChange={setPassPercent} type="number" />
          <Field label="Time limit min (optional)" value={timeLimit} onChange={setTimeLimit} type="number" />
        </div>
      </div>
      <div className="field">
        <span>
          Questions ({picked.length} picked) — approved + your own drafts
        </span>
        <div className="pick-grid">
          {candidates.map((q) => (
            <label key={q.id} className="pick">
              <input
                type="checkbox"
                checked={picked.includes(q.id)}
                onChange={(e) =>
                  setPicked((ids) => (e.target.checked ? [...ids, q.id] : ids.filter((x) => x !== q.id)))
                }
              />
              <span>
                <span className={`diff diff-${q.difficulty} small`}>{q.difficulty}</span> {q.question_text}
              </span>
            </label>
          ))}
        </div>
      </div>
      {error && <ErrorNote message={error} />}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>{busy ? "Creating…" : "Create draft"}</Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// PRACTICALS TAB
// ---------------------------------------------------------------------------

export function PracticalsTab({ course }: { course: { id: string; name: string } }) {
  const user = useUserId();
  const topicsQ = useQuery(() => api.getTopics(course.id), [course.id]);
  const practicalsQ = useQuery(async () => {
    const topics = topicsQ.data ?? [];
    const all: (Practical & { topicName: string })[] = [];
    for (const t of topics) {
      const ps = await api.getPracticals(t.id);
      for (const p of ps) all.push({ ...p, topicName: t.name });
    }
    return all;
  }, [(topicsQ.data ?? []).map((t) => t.id).join(",")]);
  const stepsQ = useQuery(async () => {
    const ps = practicalsQ.data ?? [];
    if (!ps.length) return [] as PracticalStep[];
    return api.getPracticalSteps(ps.map((p) => p.id));
  }, [(practicalsQ.data ?? []).map((p) => p.id).join(",")]);

  const [openPractical, setOpenPractical] = useState<string | null>(null);
  const [activeActivity, setActiveActivity] = useState<string | null>(null);
  const historyQ = useQuery(() => api.getMyActivityAttempts(10), []);

  if (topicsQ.loading || practicalsQ.loading) return <Spinner label="Loading practicals…" />;
  const practicals = practicalsQ.data ?? [];
  const steps = stepsQ.data ?? [];
  const activity = activeActivity ? ACTIVITY_REGISTRY[activeActivity] : null;

  return (
    <div>
      <SectionHead
        title="Practicals"
        sub="Hands-on work for this course: documented practicals plus guided quick-activities with exact grading"
      />

      <SectionHead title="Guided quick-activities" sub="Deterministic built-ins — real logic, instant exact feedback, recorded to your history" />
      <div className="activity-grid">
        {listActivities().map((a) => (
          <Card key={a.type} className="activity-tile" onClick={() => setActiveActivity(a.type)}>
            <span className="step-icon"><FlaskConical size={15} /></span>
            <div>
              <span className="eyebrow">{a.subject.toUpperCase()}</span>
              <h3>{a.title}</h3>
            </div>
            <ArrowRight size={16} className="arrow" />
          </Card>
        ))}
      </div>
      {activity && (
        <div className="activity-panel">
          <Button variant="secondary" onClick={() => setActiveActivity(null)}>← Back to activities</Button>
          <ActivityRunner
            activity={activity}
            onResult={(result, scenario, answers, timeSeconds) => {
              if (!user) return;
              void api
                .recordActivityAttempt({
                  student_id: user,
                  activity_type: activity.type,
                  subject: activity.subject,
                  scenario,
                  answer: answers,
                  is_correct: result.correct,
                  score: Math.round(result.score),
                  time_seconds: timeSeconds,
                })
                .then(() => historyQ.refresh())
                .catch((e) => console.error("activity record failed", e));
            }}
          />
        </div>
      )}

      <SectionHead title="Course practicals" sub="Approved practical work linked to this course's topics" />
      {practicals.length === 0 ? (
        <Empty
          icon={<ListChecks size={36} />}
          title="No approved practicals yet"
          body="Practicals (labs, field work, exercises) appear here once approved. Quick-activities above work immediately."
        />
      ) : (
        <div className="qbank-list">
          {practicals.map((p) => (
            <Card key={p.id} className="qbank-row">
              <div className="topic-main">
                <div className="topic-title-line">
                  <h3>{p.title}</h3>
                  <span className="tag">{p.topicName}</span>
                </div>
                {p.objective && <p className="mut small">Objective: {p.objective}</p>}
                {p.safety_notes && (
                  <p className="safety-inline">
                    <ShieldAlert size={13} /> {p.safety_notes}
                  </p>
                )}
                {openPractical === p.id && (
                  <div className="practical-detail">
                    {p.background && <p>{p.background}</p>}
                    {Array.isArray(p.procedure) && p.procedure.length > 0 && (
                      <ol>
                        {p.procedure.map((s: unknown, i: number) => (
                          <li key={i}>{String(s)}</li>
                        ))}
                      </ol>
                    )}
                    {p.expected_outcome && <p><strong>Expected outcome:</strong> {p.expected_outcome}</p>}
                    {steps.filter((s) => s.practical_id === p.id).length > 0 && (
                      <div className="mut small">
                        {steps
                          .filter((s) => s.practical_id === p.id)
                          .sort((a, b) => a.step_number - b.step_number)
                          .map((s) => `Step ${s.step_number}: ${s.instruction ?? ""}`)
                          .join(" → ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button variant="secondary" onClick={() => setOpenPractical(openPractical === p.id ? null : p.id)}>
                {openPractical === p.id ? "Hide" : "Details"}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <SectionHead title="Your activity history" sub="Every guided activity completion is recorded — this is real data, not a demo" />
      {(historyQ.data?.length ?? 0) === 0 ? (
        <p className="muted">No guided activity completions yet — try one above.</p>
      ) : (
        <div className="history-list">
          {(historyQ.data ?? []).map((h) => (
            <div key={h.id} className="history-row">
              <History size={14} className="mut" />
              <span>{ACTIVITY_REGISTRY[h.activity_type]?.title ?? h.activity_type}</span>
              <span className={`diff ${h.is_correct ? "diff-1" : "diff-5"}`}>
                {h.is_correct ? "correct" : `${Math.round(h.score ?? 0)}%`}
              </span>
              <span className="mut small">{new Date(h.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
