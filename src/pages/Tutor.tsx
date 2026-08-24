// Contextual AI Tutor — not a generic chatbot.
//
// Deterministic core (works with no AI provider): quiz me, hint, test my
// understanding — served from the topic's real question bank.
// AI-augmented tasks (explain, analogy, why-wrong, feynman evaluation) go
// through the ai-tutor Edge Function. When the provider is not configured the
// UI says so explicitly — it never fakes an AI answer.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  GraduationCap,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  PenLine,
  Send,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import { QuestionRunner, type AttemptResult } from "../components/QuestionRunner";
import { recordQuestionProgress } from "../lib/progress";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  Select,
  Spinner,
  SourceBadge,
} from "../components/ui";
import { useRoute } from "../router";
import type { AiContextPayload } from "../lib/api";

const QUICK_TASKS: { label: string; task: AiContextPayload["task"]; icon: React.ReactNode }[] = [
  { label: "Explain this", task: "explain", icon: <HelpCircle size={13} /> },
  { label: "Explain it simply", task: "explain_simply", icon: <Lightbulb size={13} /> },
  { label: "Give me an analogy", task: "analogy", icon: <Sparkles size={13} /> },
  { label: "Show me an example", task: "example", icon: <PenLine size={13} /> },
  { label: "Show the mathematical reasoning", task: "math_reasoning", icon: <Target size={13} /> },
  { label: "Give me a practical example", task: "practical_example", icon: <Target size={13} /> },
  { label: "Quiz me", task: "quiz", icon: <GraduationCap size={13} /> },
  { label: "Give me a hint", task: "hint", icon: <Lightbulb size={13} /> },
  { label: "Why is my answer wrong?", task: "why_wrong", icon: <HelpCircle size={13} /> },
  { label: "Teach me from the beginning", task: "teach_from_beginning", icon: <GraduationCap size={13} /> },
  { label: "Test whether I actually understand this", task: "test_understanding", icon: <Target size={13} /> },
];

export function TutorPage() {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  const profile = state.status === "ready" ? state.profile : null;
  const route = useRoute();

  const programmesQ = useQuery(api.getProgrammes, []);
  const coursesQ = useQuery(() => (profile?.programme_id ? api.getCourses(profile.programme_id) : Promise.resolve([])), [profile?.programme_id]);
  const [courseId, setCourseId] = useState(route.query.course ?? "");
  const effectiveCourse = courseId || coursesQ.data?.[0]?.id || "";
  const topicsQ = useQuery(() => (effectiveCourse ? api.getTopics(effectiveCourse) : Promise.resolve([])), [effectiveCourse]);
  const [topicId, setTopicId] = useState(route.query.topic ?? "");
  const effectiveTopic = topicId || topicsQ.data?.[0]?.id || "";

  const questionsQ = useQuery(
    () => (effectiveTopic ? api.getQuestions(effectiveTopic) : Promise.resolve([])),
    [effectiveTopic],
  );
  const conceptMasteryQ = useQuery(api.getConceptMastery, [user?.id]);
  const conceptsQ = useQuery(
    () => (effectiveTopic ? api.getConcepts(effectiveTopic) : Promise.resolve([])),
    [effectiveTopic],
  );
  const quizOptionsQ = useQuery(
    () => api.getQuestionOptions((questionsQ.data ?? []).map((q) => q.id)),
    [(questionsQ.data ?? []).map((q) => q.id).join(",")],
  );
  const topicMasteryQ = useQuery(api.getTopicMastery, []);

  const [mode, setMode] = useState<"chat" | "feynman">(route.query.mode === "feynman" ? "feynman" : "chat");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string; meta?: Record<string, unknown> }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [quizQuestion, setQuizQuestion] = useState<string | null>(null);
  const [feynmanText, setFeynmanText] = useState("");
  const [feynmanResult, setFeynmanResult] = useState<{ score: number | null; feedback: Record<string, unknown> | null; pending: boolean } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const topic = topicsQ.data?.find((t) => t.id === effectiveTopic);
  const course = coursesQ.data?.find((c) => c.id === effectiveCourse);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // If task query param is present on mount, automatically trigger it
  useEffect(() => {
    if (route.query.task && !messages.length && user) {
      const task = route.query.task as AiContextPayload["task"];
      void send(quickPrompt(task), task);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.query.task, user]);

  const weakConcepts = useMemo(() => {
    const byId = new Map((conceptsQ.data ?? []).map((c) => [c.id, c.name]));
    return (conceptMasteryQ.data ?? [])
      .filter((c) => c.mastery_level === "weak" || c.mastery_level === "developing")
      .map((c) => `${byId.get(c.concept_id) ?? "concept"} (${c.mastery_level})`);
  }, [conceptMasteryQ.data, conceptsQ.data]);

  async function buildPayload(task: AiContextPayload["task"], lastUserMessages: { role: "user" | "assistant"; content: string }[]): Promise<AiContextPayload> {
    const mastery = (topicMasteryQ.data ?? [])
      .filter((m) => m.topic_id === effectiveTopic)
      .map((m) => ({ topic: topic?.name ?? "", level: m.mastery_level, score: m.mastery_score }));
    return {
      programme: programmesQ.data?.find((p) => p.id === profile?.programme_id)?.name ?? null,
      year: profile?.current_year ?? null,
      semester: profile?.current_semester ?? null,
      course: course?.name ?? null,
      topic: topic?.name ?? null,
      concept: null,
      session: null,
      mastery,
      weak_concepts: weakConcepts,
      recent_attempts: [],
      sources: [],
      task,
      messages: lastUserMessages,
    };
  }

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    if (!user) throw new Error("Not signed in");
    const conv = await api.createConversation({
      student_id: user.id,
      course_id: effectiveCourse || null,
      topic_id: effectiveTopic || null,
      mode: "tutor",
      title: topic ? `Tutor — ${topic.name}` : "Tutor",
    });
    setConversationId(conv.id);
    return conv.id;
  }

  async function send(text: string, task: AiContextPayload["task"]) {
    if (!user || !text.trim() || busy) return;
    setAiError(null);
    const msgs = [...messages, { role: "user" as const, content: text.trim() }];
    setMessages(msgs);
    setInput("");
    setBusy(true);

    // Deterministic core: quiz/hint/test come straight from the question bank.
    if (task === "quiz" || task === "test_understanding") {
      setBusy(false);
      const bank = questionsQ.data ?? [];
      if (!bank.length) {
        setMessages([
          ...msgs,
          {
            role: "assistant",
            content: "There are no approved questions in the question bank for this topic yet. Add questions from the topic page — the quiz draws on them directly.",
          },
        ]);
        return;
      }
      const q = bank[Math.floor(Math.random() * bank.length)];
      setQuizQuestion(q.id);
      setMessages([
        ...msgs,
        { role: "assistant", content: `Here's one from this topic's question bank — solve it the normal way (hints available if you get stuck).` },
      ]);
      return;
    }
    if (task === "hint") {
      setBusy(false);
      const bank = questionsQ.data ?? [];
      const q = bank[0];
      if (!q) {
        setMessages([...msgs, { role: "assistant", content: "No questions with hints exist for this topic yet." }]);
        return;
      }
      setMessages([
        ...msgs,
        {
          role: "assistant",
          content: `Hint for “${q.question_text.slice(0, 80)}…”\n${q.hint_1 ?? "No hint recorded for this question yet — add one from the topic page."}`,
        },
      ]);
      return;
    }

    // AI tasks — require the Edge Function + provider.
    try {
      const convId = await ensureConversation();
      const payload = await buildPayload(task, msgs.map((m) => ({ role: m.role, content: m.content })));
      await api.addMessage({ conversation_id: convId, role: "user", content: text.trim() });
      const reply = await api.invokeAiTutor({ ...payload, conversation_id: convId });
      setAiConfigured(true);
      await api.addMessage({
        conversation_id: convId,
        role: "assistant",
        content: reply.content,
        metadata: { source_level: reply.source_level, needs_more_info: reply.needs_more_info, missing_info: reply.missing_info },
      });
      setMessages([
        ...msgs,
        { role: "assistant", content: reply.content, meta: { source_level: reply.source_level, needs_more_info: reply.needs_more_info } },
      ]);
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      if (err.message.includes("ai_not_configured") || err.message.toLowerCase().includes("not configured") || err.message.includes("404") || err.message.includes("not found") || err.message.includes("does not exist")) {
        setAiConfigured(false);
        setAiError(
          "The AI provider is not configured for this deployment. Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) as a secret on the ai-tutor Edge Function and redeploy — quiz, hint and the rest of StudyLab keep working meanwhile.",
        );
        setMessages([...msgs, { role: "assistant", content: "(AI answer unavailable — provider not configured. The deterministic features — quiz me, hint, test my understanding — still work.)" }]);
      } else {
        setAiError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitFeynman() {
    if (!user || !feynmanText.trim()) return;
    setBusy(true);
    setAiError(null);
    const attempt = await api.addExplainBackAttempt({
      student_id: user.id,
      topic_id: effectiveTopic || null,
      concept_id: null,
      prompt: `Explain “${topic?.name ?? "this concept"}” in your own words.`,
      student_response: feynmanText.trim(),
      ai_feedback: null,
      score: null,
    });
    try {
      const convId = await ensureConversation();
      const payload = await buildPayload("feynman_evaluate", [
        { role: "user", content: feynmanText.trim() },
      ]);
      await api.addMessage({ conversation_id: convId, role: "user", content: feynmanText.trim() });
      const reply = await api.invokeAiTutor({ ...payload, conversation_id: convId });
      const feedback = parseFeynmanFeedback(reply.content);
      await api.updateExplainBackAttempt(attempt.id, { ai_feedback: feedback, score: feedback.score ?? null });
      await api.addMessage({ conversation_id: convId, role: "assistant", content: reply.content, metadata: { feynman: true } });
      setFeynmanResult({ score: feedback.score ?? null, feedback, pending: false });
      setFeynmanText("");
    } catch {
      setFeynmanResult({ score: null, feedback: null, pending: true });
    } finally {
      setBusy(false);
    }
  }

  const quizQ = (questionsQ.data ?? []).find((q) => q.id === quizQuestion);
  const quizOptions = (quizOptionsQ.data ?? []).filter((o) => o.question_id === quizQuestion);

  return (
    <section className="page tutor-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STUDYLAB AI TUTOR</span>
          <h1>
            <Brain size={22} /> Tutor
          </h1>
          <p>
            Context-aware: it knows your programme, course, topic, session progress and mastery. It scaffolds — hints
            before answers, and it tells you when a source is missing.
          </p>
        </div>
      </div>

      <div className="tutor-context">
        <Select
          value={effectiveCourse}
          onChange={(v) => { setCourseId(v); setTopicId(""); setQuizQuestion(null); }}
          options={(coursesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          value={effectiveTopic}
          onChange={(v) => { setTopicId(v); setQuizQuestion(null); }}
          options={[{ value: "", label: "All topics" }, ...(topicsQ.data ?? []).map((t) => ({ value: t.id, label: t.name }))]}
        />
        <div className="tutor-mode">
          <button className={mode === "chat" ? "active" : ""} onClick={() => setMode("chat")}>
            <MessageSquare size={13} /> Chat
          </button>
          <button className={mode === "feynman" ? "active" : ""} onClick={() => setMode("feynman")}>
            <PenLine size={13} /> Explain-back (Feynman)
          </button>
        </div>
      </div>

      {aiConfigured === false && (
        <div className="pending-banner">
          <Sparkles size={16} />
          <div>
            <strong>AI answers pending</strong>
            <p>The ai-tutor Edge Function needs an AI provider key (ANTHROPIC_API_KEY or OPENAI_API_KEY). Deploy steps are in the README; deterministic features work now.</p>
          </div>
        </div>
      )}

      {mode === "chat" ? (
        <div className="tutor-chat">
          <Card className="tutor-messages">
            {messages.length === 0 && (
              <div className="tutor-empty">
                <Brain size={30} />
                <p>Pick a context above, then ask — or use a task below.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <span className="msg-who">{m.role === "user" ? <User size={13} /> : <Brain size={13} />}</span>
                <div className="msg-bubble">
                  {"meta" in m && m.meta?.source_level != null ? (
                    <SourceBadge level={m.meta.source_level as 1 | 2 | 3 | 4} />
                  ) : null}
                  <p>{m.content}</p>
                  {"meta" in m && m.meta?.needs_more_info === true && (
                    <small className="mut">The tutor could not ground this in your sources — more material would help.</small>
                  )}
                </div>
              </div>
            ))}
            {busy && <Spinner label="Thinking…" />}
            {quizQ && (
              <div className="tutor-quiz">
                <QuestionRunner
                  key={quizQ.id}
                  question={quizQ}
                  options={quizOptions}
                  hintBudget={2}
                  onAttempt={(r: AttemptResult) => void recordQuestionProgress({ userId: user?.id ?? "", question: quizQ, sessionId: null, result: r })}
                  onComplete={() => setQuizQuestion(null)}
                />
              </div>
            )}
            <div ref={endRef} />
          </Card>

          <div className="quick-tasks">
            {QUICK_TASKS.map((t) => (
              <button key={t.label} className="quick-task" disabled={busy} onClick={() => send(quickPrompt(t.task), t.task)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="tutor-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) send(input, "tutor");
              }}
              placeholder={`Ask about ${topic?.name ?? "your course"}…`}
            />
            <Button onClick={() => send(input, "tutor")} disabled={busy || !input.trim()}>
              <Send size={14} />
            </Button>
          </div>
          {aiError && <ErrorNote message={aiError} />}
        </div>
      ) : (
        <Card className="feynman-card">
          <div className="step-head">
            <span className="step-icon"><PenLine size={16} /></span>
            <div>
              <span className="eyebrow">FEYNMAN MODE — EXPLAIN-BACK</span>
              <h2>Teach “{topic?.name ?? "the concept"}” to an imaginary peer</h2>
            </div>
          </div>
          <p className="mut small">
            Explain in your own words. The tutor scores conceptual correctness, missing ideas, misconceptions, clarity
            and application. If the AI provider is not configured, your explanation is still stored and marked pending
            — nothing is faked.
          </p>
          <Field label="Your explanation" value={feynmanText} onChange={setFeynmanText} rows={7} placeholder={`${topic?.name ?? "Concept"} is…`} />
          <div className="step-actions">
            <Button onClick={submitFeynman} disabled={busy || !feynmanText.trim()}>
              {busy ? "Evaluating…" : "Evaluate my explanation"}
            </Button>
          </div>
          {feynmanResult && (
            <div className={`feynman-result ${feynmanResult.pending ? "pending" : ""}`}>
              {feynmanResult.pending ? (
                <>
                  <strong>Explanation saved — evaluation pending.</strong>
                  <p className="mut small">AI feedback arrives when the provider is configured. Your answer is stored with the attempt.</p>
                </>
              ) : (
                <>
                  {feynmanResult.score !== null && <h3>Score: {feynmanResult.score}/100</h3>}
                  {feynmanResult.feedback && (
                    <ul>
                      {Object.entries(feynmanResult.feedback)
                        .filter(([k]) => !k.startsWith("_"))
                        .map(([k, v]) => (
                          <li key={k}>
                            <strong>{k.replace(/_/g, " ")}:</strong> {String(v)}
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}
        </Card>
      )}
    </section>
  );
}

function quickPrompt(task: AiContextPayload["task"]): string {
  switch (task) {
    case "explain":
      return "Explain this topic using my course material first.";
    case "explain_simply":
      return "Explain it simply, as if I'm seeing it for the first time.";
    case "analogy":
      return "Give me an analogy from everyday life for this concept.";
    case "example":
      return "Show me a concrete example with numbers or a real situation.";
    case "math_reasoning":
      return "Show me the mathematical reasoning step by step.";
    case "practical_example":
      return "Give me a practical example — a lab or real-world task.";
    case "quiz":
      return "Quiz me on this topic.";
    case "hint":
      return "Give me a hint for the current question.";
    case "why_wrong":
      return "Why is my last answer wrong? Identify the reasoning gap.";
    case "teach_from_beginning":
      return "Teach me from the beginning, checking as we go.";
    case "test_understanding":
      return "Test whether I actually understand this — not just recognition.";
    default:
      return "";
  }
}

function parseFeynmanFeedback(content: string): Record<string, unknown> & { score?: number } {
  const m = content.match(/\d+\s*\/\s*100/);
  const out: Record<string, unknown> = { summary: content.slice(0, 400) };
  if (m) {
    const s = parseInt(m[0], 10);
    if (!Number.isNaN(s)) out.score = s;
  }
  return out;
}
