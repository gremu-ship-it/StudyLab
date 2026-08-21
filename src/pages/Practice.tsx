import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, HelpCircle, RotateCcw, Target, Zap } from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import type { Question } from "../types";
import { categoryAccent, masteryColor, toast } from "../components/ui";
import { BookOpen } from "lucide-react";

export function PracticePage({ nav, initialTopicId }: { nav: NavFn; initialTopicId?: string }) {
  const db = useStore((d) => d);
  const sid = store.studentId;
  const [topicId, setTopicId] = useState<string | null>(initialTopicId ?? null);
  const [mix, setMix] = useState(false);

  const topicsWithQuestions = useMemo(() =>
    db.topics.filter((t) => db.questions.some((q) => q.topic_id === t.id)),
    [db.topics, db.questions]
  );

  const questions: Question[] = useMemo(() => {
    if (mix) return shuffle(db.questions).slice(0, 8);
    if (!topicId) return [];
    return shuffle(db.questions.filter((q) => q.topic_id === topicId));
  }, [mix, topicId, db.questions]);

  if (mix || topicId) {
    return <QuizRunner questions={questions} nav={nav} onExit={() => { setMix(false); setTopicId(null); }} />;
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Active recall · spaced practice</span>
          <h1>Practice</h1>
          <p>Answer questions to update topic mastery and schedule your next review.</p>
        </div>
        <button className="primary" onClick={() => setMix(true)}><Zap size={16} /> Mixed 8-question set</button>
      </div>

      <div className="course-grid">
        {topicsWithQuestions.map((t) => {
          const course = db.courses.find((c) => c.id === t.course_id)!;
          const m = db.topic_mastery.find((x) => x.student_id === sid && x.topic_id === t.id);
          const qCount = db.questions.filter((q) => q.topic_id === t.id).length;
          return (
            <button key={t.id} className="course-card" onClick={() => setTopicId(t.id)}>
              <div className={`course-icon ${categoryAccent[course.category ?? ""] ?? "math"}`}><HelpCircle size={19} /></div>
              <div className="course-main">
                <span>{course.code} · {qCount} questions</span>
                <h3>{t.name}</h3>
                <small>{course.name}</small>
              </div>
              <ChevronRight size={18} className="arrow" />
              <div className="progress-row"><span>Mastery</span><strong>{m?.mastery_score ?? 0}%</strong></div>
              <div className="progress"><i style={{ width: `${m?.mastery_score ?? 0}%`, background: masteryColor(m?.mastery_score ?? 0) }} /></div>
            </button>
          );
        })}
      </div>

      {topicsWithQuestions.length === 0 && (
        <div className="empty-state"><BookOpen size={34} /><h2>No question banks yet</h2><p>Questions appear with curriculum topics. Ask the AI tutor to generate a practice set for any topic.</p></div>
      )}
    </section>
  );
}

function QuizRunner({ questions, nav, onExit }: { questions: Question[]; nav: NavFn; onExit: () => void }) {
  const optionsAll = useStore((db) => db.question_options);
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [done, setDone] = useState(false);

  const q = questions[idx];

  function check() {
    let correct = false;
    if (!q) return;
    if (q.question_type === "multiple_choice" || q.question_type === "true_false") correct = sel === q.correct_answer.key;
    else if (q.question_type === "numeric") correct = Number(text) === q.correct_answer.number;
    else correct = text.trim().toLowerCase() === (q.correct_answer.value ?? "").toLowerCase();
    setRevealed(true);
    setResults((r) => [...r, correct]);
    store.recordQuestionAttempt(q.id, null, sel ?? text, correct, 18, sel ? 3 : 2);
  }
  function next() {
    setRevealed(false); setSel(null); setText("");
    if (idx < questions.length - 1) setIdx(idx + 1);
    else { setDone(true); toast("Set complete · mastery updated"); }
  }

  if (!questions.length) {
    return <section className="page"><div className="empty-state"><HelpCircle size={32} /><h2>No questions in this topic yet</h2><button className="primary" onClick={onExit}>Back to practice</button></div></section>;
  }

  if (done) {
    const score = results.filter(Boolean).length;
    const pct = Math.round((score / questions.length) * 100);
    return (
      <section className="page">
        <button className="back-btn" onClick={onExit}><ArrowLeft size={15} /> Practice topics</button>
        <div className="panel" style={{ textAlign: "center", padding: 40 }}>
          <div className="ring-wrap" style={{ margin: "0 auto 16px" }}>
            <div className="ring" style={{ ["--p" as string]: pct, ["--c" as string]: masteryColor(pct) }} />
            <div style={{ position: "absolute", textAlign: "center" }}><strong style={{ fontSize: 26 }}>{pct}%</strong></div>
          </div>
          <h2>{pct >= 80 ? "Excellent work! 🎉" : pct >= 50 ? "Solid effort — keep going" : "Good start — review and retry"}</h2>
          <p style={{ margin: "8px 0 18px" }}>{score} of {questions.length} correct. Your mastery and review schedule have been updated.</p>
          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <button className="primary" onClick={() => { setIdx(0); setResults([]); setDone(false); }}><RotateCcw size={16} /> Retry set</button>
            <button className="secondary" onClick={() => nav({ name: "review" })}><Target size={16} /> Go to reviews</button>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 14 }}>
          <h3 style={{ marginBottom: 10 }}>Question review</h3>
          {questions.map((qq, i) => (
            <div key={qq.id} className="list-item" style={{ background: "transparent", padding: "10px 0", borderBottom: "1px solid var(--border-soft)" }}>
              <div className="grow"><h3>{i + 1}. {qq.question_text}</h3><p>{qq.explanation}</p></div>
              <span className={`chip ${results[i] ? "good" : "bad"}`}>{results[i] ? "Correct" : "Incorrect"}</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const options = optionsAll.filter((o) => o.question_id === q.id).sort((a, b) => a.sequence_number - b.sequence_number);

  return (
    <section className="page" style={{ maxWidth: 820 }}>
      <button className="back-btn" onClick={onExit}><ArrowLeft size={15} /> Exit practice</button>
      <div className="panel">
        <div className="spread">
          <span className="eyebrow">Question {idx + 1} of {questions.length}</span>
          <div style={{ display: "flex", gap: 6 }}>
            {questions.map((_, i) => <span key={i} className="dot" style={{ background: i < idx ? "var(--good)" : i === idx ? "var(--brand)" : "var(--surface-3)", width: 10, height: 10 }} />)}
          </div>
        </div>
        <h2 style={{ fontSize: 20, margin: "14px 0 20px" }}>{q.question_text}</h2>

        {(q.question_type === "multiple_choice" || q.question_type === "true_false") && options.map((o) => {
          let cls = "";
          if (revealed) {
            if (o.option_key === q.correct_answer.key) cls = "correct";
            else if (o.option_key === sel) cls = "wrong";
          }
          return (
            <button key={o.id} className={`quiz-option ${cls}`} disabled={revealed} onClick={() => setSel(o.option_key)}>
              <span className="key">{o.option_key}</span> {o.option_text}
            </button>
          );
        })}
        {q.question_type === "short_answer" && <input value={text} onChange={(e) => setText(e.target.value)} disabled={revealed} placeholder="Your answer" />}
        {q.question_type === "numeric" && <input type="number" value={text} onChange={(e) => setText(e.target.value)} disabled={revealed} placeholder="A number" />}

        {revealed && (
          <div className={`feedback ${(results[results.length - 1]) ? "good" : "bad"}`}>
            <strong>{results[results.length - 1] ? "Correct! " : "Not quite. "}</strong>{q.explanation}
          </div>
        )}

        <div className="row" style={{ marginTop: 18, justifyContent: "space-between" }}>
          <span className="chip muted">{q.question_type.replace("_", " ")} · diff {q.difficulty}/5</span>
          {!revealed
            ? <button className="primary" disabled={(q.question_type === "multiple_choice" || q.question_type === "true_false") ? !sel : !text.trim()} onClick={check}>Check answer</button>
            : <button className="primary" onClick={next}>{idx < questions.length - 1 ? "Next question" : "See results"}</button>}
        </div>
        {q.hint_1 && !revealed && <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>💡 {q.hint_1}</p>}
      </div>
    </section>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
