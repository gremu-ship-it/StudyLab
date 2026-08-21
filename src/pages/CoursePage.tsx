import { useMemo, useState } from "react";
import {
  ArrowLeft, BookOpen, ChevronRight, FileText, FlaskConical, HelpCircle,
  Library, Link2, ListTree, Plus, Sparkles, Target, Video,
} from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import type { UnitType } from "../types";
import { categoryAccent, masteryColor, timeAgo } from "../components/ui";
import { Modal, toast } from "../components/ui";

type Tab = "units" | "practice" | "practicals" | "resources" | "manage";

export function CoursePage({ courseId, nav }: { courseId: string; nav: NavFn }) {
  const db = useStore((d) => d);
  const sid = store.studentId;
  const [tab, setTab] = useState<Tab>("units");
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [topicName, setTopicName] = useState("");
  const [topicDesc, setTopicDesc] = useState("");
  const [unitFilters, setUnitFilters] = useState<{ type: UnitType | "all"; subtopic: string | "all" }>({ type: "all", subtopic: "all" });

  const course = db.courses.find((c) => c.id === courseId);
  const offering = db.course_offerings.find((o) => o.course_id === courseId);
  const topics = useMemo(() => db.topics.filter((t) => t.course_id === courseId).sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0)), [db.topics, courseId]);
  const activeTopic = topics.find((t) => t.id === selectedTopic) ?? topics[0];
  const subtopics = db.subtopics.filter((s) => s.topic_id === activeTopic?.id).sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0));
  const units = db.learning_units.filter((u) => u.topic_id === activeTopic?.id).sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0));
  const questions = db.questions.filter((q) => q.topic_id === activeTopic?.id);
  const practicals = db.practicals.filter((p) => p.topic_id === activeTopic?.id);
  const resources = db.topic_resources.filter((tr) => tr.topic_id === activeTopic?.id).map((tr) => db.content_resources.find((r) => r.id === tr.resource_id)!).filter(Boolean);
  const mastery = db.topic_mastery.find((m) => m.student_id === sid && m.topic_id === activeTopic?.id);

  if (!course) return <section className="page"><p>Course not found.</p></section>;

  function addTopic() {
    if (!topicName.trim()) return;
    store.addTopic(courseId, topicName.trim(), topicDesc.trim());
    setShowAddTopic(false); setTopicName(""); setTopicDesc("");
    toast("Topic added to your curriculum");
  }

  return (
    <section className="page">
      <button className="back-btn" onClick={() => nav({ name: "courses" })}><ArrowLeft size={15} /> All courses</button>

      <div className="course-header">
        <div className={`course-icon ${categoryAccent[course.category ?? ""] ?? "math"}`} style={{ width: 52, height: 52, borderRadius: 14 }}><BookOpen size={24} /></div>
        <div className="grow">
          <span className="eyebrow">{course.code} · {course.category}</span>
          <h1 style={{ margin: "2px 0" }}>{course.name}</h1>
          <p>{course.description}{offering?.lecturer_name ? ` · Lecturer: ${offering.lecturer_name}` : ""}</p>
        </div>
        <button className="secondary" onClick={() => activeTopic && nav({ name: "ai", topicId: activeTopic.id, courseId: course.id })}><Sparkles size={16} /> Ask AI</button>
        <button className="primary" onClick={() => setShowAddTopic(true)}><Plus size={16} /> Topic</button>
      </div>

      <div className="topic-layout">
        {/* Topic sidebar */}
        <div className="panel" style={{ padding: 12 }}>
          <div className="spread" style={{ padding: "4px 6px 10px" }}>
            <h3 style={{ fontSize: 13, color: "var(--text-mute)", textTransform: "uppercase", letterSpacing: 1 }}>Topics</h3>
            <button className="ghost small" onClick={() => setShowAddTopic(true)}><Plus size={14} /></button>
          </div>
          <div className="topic-list">
            {topics.map((t) => {
              const m = db.topic_mastery.find((x) => x.student_id === sid && x.topic_id === t.id);
              const pct = m?.mastery_score ?? 0;
              return (
                <button key={t.id} className={`topic-row ${activeTopic?.id === t.id ? "active" : ""}`} onClick={() => setSelectedTopic(t.id)}>
                  <div className="tname">
                    <strong>{t.name}</strong>
                    <span>{t.status === "student_added" ? "Your topic" : "Curriculum"}</span>
                  </div>
                  <div className="mini-progress"><i style={{ width: `${pct}%` }} /></div>
                </button>
              );
            })}
            {topics.length === 0 && <p className="muted" style={{ padding: 12, fontSize: 12 }}>No topics yet. Add one to begin.</p>}
          </div>
        </div>

        {/* Topic content */}
        <div>
          {activeTopic ? (
            <>
              <div className="spread" style={{ marginBottom: 8 }}>
                <div>
                  <span className="eyebrow">{activeTopic.status === "student_added" ? "Student topic" : "Curriculum topic"}</span>
                  <h2 style={{ marginTop: 2 }}>{activeTopic.name}</h2>
                  <p style={{ marginTop: 4 }}>{activeTopic.description}</p>
                </div>
                {mastery && (
                  <div className="row" style={{ gap: 18 }}>
                    <div className="kv" style={{ textAlign: "right" }}><span>Mastery</span><strong style={{ color: masteryColor(mastery.mastery_score) }}>{mastery.mastery_score}%</strong></div>
                    <div className="kv" style={{ textAlign: "right" }}><span>Last practiced</span><strong style={{ fontSize: 13 }}>{timeAgo(mastery.last_practiced_at)}</strong></div>
                  </div>
                )}
              </div>

              <div className="tabs">
                <TabBtn id="units" current={tab} set={setTab} icon={<Library size={14} />} label={`Learning${units.length ? ` (${units.length})` : ""}`} />
                <TabBtn id="practice" current={tab} set={setTab} icon={<HelpCircle size={14} />} label={`Practice${questions.length ? ` (${questions.length})` : ""}`} />
                <TabBtn id="practicals" current={tab} set={setTab} icon={<FlaskConical size={14} />} label={`Practicals${practicals.length ? ` (${practicals.length})` : ""}`} />
                <TabBtn id="resources" current={tab} set={setTab} icon={<Link2 size={14} />} label={`Resources${resources.length ? ` (${resources.length})` : ""}`} />
                <TabBtn id="manage" current={tab} set={setTab} icon={<ListTree size={14} />} label="Structure" />
              </div>

              {tab === "units" && (
                <UnitsTab
                  units={units} subtopics={subtopics} filters={unitFilters} setFilters={setUnitFilters}
                  onPractice={() => setTab("practice")}
                />
              )}
              {tab === "practice" && (
                <PracticeSet key={activeTopic.id} questions={questions} courseId={course.id} topicId={activeTopic.id} nav={nav} />
              )}
              {tab === "practicals" && <PracticalsTab practicals={practicals} />}
              {tab === "resources" && <ResourcesTab resources={resources} />}
              {tab === "manage" && <StructureTab topicId={activeTopic.id} subtopics={subtopics} unitsCount={units.length} questionsCount={questions.length} />}
            </>
          ) : (
            <div className="empty-state">
              <BookOpen size={36} />
              <h2>No topics yet</h2>
              <p>Add the topic your lecturer introduced today and StudyLab will start building a learning pack.</p>
              <div className="hero-actions"><button className="primary" onClick={() => setShowAddTopic(true)}><Plus size={16} /> Add first topic</button></div>
            </div>
          )}
        </div>
      </div>

      <Modal open={showAddTopic} onClose={() => setShowAddTopic(false)} eyebrow="Curriculum inbox" title="Add a new topic"
        footer={<>
          <button className="secondary" onClick={() => setShowAddTopic(false)}>Cancel</button>
          <button className="primary" onClick={addTopic}><Plus size={16} /> Add to curriculum</button>
        </>}>
        <p className="muted">Student-added topics enter your private curriculum and power AI learning, practice and review.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          <label>Topic name<input value={topicName} onChange={(e) => setTopicName(e.target.value)} placeholder="e.g. Integration by substitution" autoFocus /></label>
          <label>What should StudyLab know? (optional)<textarea value={topicDesc} onChange={(e) => setTopicDesc(e.target.value)} placeholder="Key ideas, lecture context, or what you find tricky..." /></label>
        </div>
      </Modal>
    </section>
  );
}

function TabBtn({ id, current, set, icon, label }: { id: Tab; current: Tab; set: (t: Tab) => void; icon: React.ReactNode; label: string }) {
  return <button className={`tab ${current === id ? "active" : ""}`} onClick={() => set(id)}>{icon} {label}</button>;
}

const unitTypeIcon: Record<UnitType, React.ReactNode> = {
  explanation: <BookOpen size={18} />, video: <Video size={18} />, worked_example: <FileText size={18} />,
  interactive: <Target size={18} />, practical: <FlaskConical size={18} />, practice: <HelpCircle size={18} />,
  reflection: <Sparkles size={18} />, review: <Target size={18} />,
};
const unitTypeLabel: Record<UnitType, string> = {
  explanation: "Explanation", video: "Video", worked_example: "Worked example", interactive: "Interactive",
  practical: "Practical", practice: "Practice", reflection: "Reflection", review: "Review",
};

function UnitsTab({ units, subtopics, filters, setFilters, onPractice }: {
  units: import("../types").LearningUnit[]; subtopics: import("../types").Subtopic[];
  filters: { type: UnitType | "all"; subtopic: string | "all" };
  setFilters: (f: { type: UnitType | "all"; subtopic: string | "all" }) => void; onPractice: () => void;
}) {
  const filtered = units.filter((u) =>
    (filters.type === "all" || u.unit_type === filters.type) &&
    (filters.subtopic === "all" || u.subtopic_id === filters.subtopic)
  );
  const [openId, setOpenId] = useState<string | null>(units[0]?.id ?? null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  function toggleComplete(id: string) {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else { next.add(id); store.recordLearningAttempt(id, null, 100); toast("Unit completed · mastery updated"); }
      return next;
    });
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <select value={filters.subtopic} onChange={(e) => setFilters({ ...filters, subtopic: e.target.value })}>
          <option value="all">All subtopics</option>
          {subtopics.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value as UnitType | "all" })}>
          <option value="all">All types</option>
          {(Object.keys(unitTypeLabel) as UnitType[]).map((t) => <option key={t} value={t}>{unitTypeLabel[t]}</option>)}
        </select>
        <button className="primary small" onClick={onPractice} style={{ marginLeft: "auto" }}><Target size={14} /> Practise topic</button>
      </div>

      {filtered.length === 0 && <div className="empty-state"><Library size={30} /><h2>No units match</h2><p>Try a different filter or add a learning unit from the Structure tab.</p></div>}

      {filtered.map((u) => {
        const open = openId === u.id;
        const done = completed.has(u.id);
        return (
          <div key={u.id} className="unit-card" style={{ borderColor: done ? "rgba(52,211,153,.3)" : undefined }}>
            <button className="unit-head" onClick={() => setOpenId(open ? null : u.id)} style={{ width: "100%", textAlign: "left", background: "none" }}>
              <div className="unit-type">{unitTypeIcon[u.unit_type]}</div>
              <div className="grow">
                <h3>{u.title}{done && <span className="chip good" style={{ marginLeft: 8 }}>Done</span>}</h3>
                <p style={{ fontSize: 12 }}>{unitTypeLabel[u.unit_type]} · {u.estimated_minutes} min · difficulty {u.difficulty}/5</p>
              </div>
              <ChevronRight size={18} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", color: "var(--text-mute)" }} />
            </button>
            {open && (
              <div style={{ marginTop: 10 }}>
                <div className="unit-body">{u.body}</div>
                <div className="row" style={{ marginTop: 14 }}>
                  <button className={done ? "secondary small" : "primary small"} onClick={() => toggleComplete(u.id)}>
                    {done ? "Completed ✓" : "Mark complete"}
                  </button>
                  <button className="ghost small" onClick={onPractice}>Practise this</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PracticeSet({ questions, courseId, topicId, nav }: {
  questions: import("../types").Question[]; courseId: string; topicId: string; nav: NavFn;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const q = questions[index];

  if (!q) {
    return <div className="empty-state"><HelpCircle size={32} /><h2>No questions yet</h2><p>Questions appear as the curriculum is populated. Ask the AI tutor to generate practice for this topic.</p>
      <button className="primary" onClick={() => nav({ name: "ai", topicId, courseId })}><Sparkles size={16} /> Generate with AI</button></div>;
  }
  const options = useStore((db) => db.question_options.filter((o) => o.question_id === q.id).sort((a, b) => a.sequence_number - b.sequence_number));
  const correctKey = q.correct_answer.key;

  const [correct, setCorrect] = useState(false);
  function check() {
    let isCorrect = false;
    if (q.question_type === "multiple_choice" || q.question_type === "true_false") isCorrect = selected === correctKey;
    else if (q.question_type === "numeric") isCorrect = Number(answer) === q.correct_answer.number;
    else isCorrect = answer.trim().toLowerCase() === (q.correct_answer.value ?? "").toLowerCase();
    setCorrect(isCorrect);
    setRevealed(true);
    store.recordQuestionAttempt(q.id, null, selected ?? answer, isCorrect, 20, selected ? 3 : 2);
  }
  function next() {
    setRevealed(false); setSelected(null); setAnswer("");
    setIndex((i) => Math.min(questions.length - 1, i + 1));
  }

  return (
    <div className="panel">
      <div className="spread"><span className="eyebrow">Question {index + 1} of {questions.length}</span><span className="chip muted">Difficulty {q.difficulty}/5 · {q.question_type.replace("_", " ")}</span></div>
      <h2 style={{ fontSize: 18, margin: "12px 0 18px" }}>{q.question_text}</h2>

      {(q.question_type === "multiple_choice" || q.question_type === "true_false") && (
        <div>
          {options.map((o) => {
            let cls = "";
            if (revealed) {
              if (o.option_key === correctKey) cls = "correct";
              else if (o.option_key === selected) cls = "wrong";
            }
            return (
              <button key={o.id} className={`quiz-option ${cls}`} disabled={revealed} onClick={() => setSelected(o.option_key)}>
                <span className="key">{o.option_key}</span> {o.option_text}
              </button>
            );
          })}
        </div>
      )}
      {(q.question_type === "short_answer") && (
        <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your answer..." disabled={revealed} />
      )}
      {q.question_type === "numeric" && (
        <input type="number" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Enter a number" disabled={revealed} />
      )}

        {revealed && (
          <div className={`feedback ${correct ? "good" : "bad"}`}>
            <strong>{correct ? "Correct! " : "Not quite. "}</strong>
            {q.explanation}
          </div>
        )}

      <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
        {!revealed
          ? <button className="primary" onClick={check} disabled={(q.question_type === "multiple_choice" || q.question_type === "true_false") ? !selected : !answer.trim()}>Check answer</button>
          : <button className="primary" onClick={next}>{index < questions.length - 1 ? "Next question" : "Finish set"}</button>}
      </div>
      {q.hint_1 && !revealed && <p className="muted" style={{ marginTop: 12, fontSize: 12 }}>💡 Hint: {q.hint_1}</p>}
    </div>
  );
}

function PracticalsTab({ practicals }: { practicals: import("../types").Practical[] }) {
  const [openId, setOpenId] = useState<string | null>(practicals[0]?.id ?? null);
  const steps = useStore((db) => db.practical_steps);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  if (!practicals.length) return <div className="empty-state"><FlaskConical size={32} /><h2>No practicals yet</h2><p>Practical simulations and lab guides for this topic appear here.</p></div>;
  return (
    <div>
      {practicals.map((p) => {
        const psteps = steps.filter((s) => s.practical_id === p.id).sort((a, b) => a.step_number - b.step_number);
        const open = openId === p.id;
        return (
          <div key={p.id} className="panel" style={{ marginBottom: 12 }}>
            <button className="spread" onClick={() => setOpenId(open ? null : p.id)} style={{ width: "100%", textAlign: "left", background: "none" }}>
              <div className="row"><FlaskConical size={18} style={{ color: "var(--accent)" }} /><h3>{p.title}</h3></div>
              <ChevronRight size={18} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            </button>
            {open && (
              <div style={{ marginTop: 14 }}>
                <p><strong style={{ color: "var(--text)" }}>Objective:</strong> {p.objective}</p>
                {p.safety_notes && <div className="notice" style={{ background: "rgba(248,113,113,.1)", borderColor: "rgba(248,113,113,.3)" }}><Sparkles size={18} style={{ color: "var(--bad)" }} /><div><strong>Safety</strong><p>{p.safety_notes}</p></div></div>}
                <h4 style={{ margin: "16px 0 8px", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--brand)" }}>Procedure</h4>
                {psteps.map((s) => (
                  <label key={s.id} className="check-line">
                    <input type="checkbox" checked={checked.has(s.id)} onChange={(e) => setChecked((prev) => { const n = new Set(prev); e.target.checked ? n.add(s.id) : n.delete(s.id); return n; })} />
                    <span><strong>Step {s.step_number}.</strong> {s.instruction}</span>
                  </label>
                ))}
                {p.expected_outcome && <p style={{ marginTop: 12 }}><strong style={{ color: "var(--text)" }}>Expected outcome:</strong> {p.expected_outcome}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResourcesTab({ resources }: { resources: import("../types").ContentResource[] }) {
  if (!resources.length) return <div className="empty-state"><Link2 size={32} /><h2>No resources linked</h2><p>Curated videos, documents and websites will appear here.</p></div>;
  return (
    <div className="list">
      {resources.map((r) => (
        <a key={r.id} href={r.url ?? "#"} target="_blank" rel="noreferrer" className="list-item clickable">
          <div className="unit-type">{r.resource_type === "youtube" ? <Video size={18} /> : r.resource_type === "document" ? <FileText size={18} /> : <Link2 size={18} />}</div>
          <div className="grow"><h3>{r.title}</h3><p>{r.provider ?? r.resource_type}{r.duration_seconds ? ` · ${Math.round(r.duration_seconds / 60)} min` : ""}</p></div>
          <ChevronRight size={16} />
        </a>
      ))}
    </div>
  );
}

function StructureTab({ topicId, subtopics, unitsCount, questionsCount }: { topicId: string; subtopics: import("../types").Subtopic[]; unitsCount: number; questionsCount: number }) {
  const [subName, setSubName] = useState("");
  const [unitTitle, setUnitTitle] = useState("");
  const [unitBody, setUnitBody] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("explanation");
  const [subForUnit, setSubForUnit] = useState<string>("");

  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-head"><h3>Subtopics ({subtopics.length})</h3></div>
        <div className="list" style={{ marginBottom: 14 }}>
          {subtopics.map((s) => <div key={s.id} className="list-item"><ListTree size={16} style={{ color: "var(--brand)" }} /><div className="grow"><h3>{s.name}</h3></div><span className="chip muted">{s.status}</span></div>)}
          {!subtopics.length && <p className="muted" style={{ fontSize: 13 }}>Break this topic into subtopics.</p>}
        </div>
        <div className="field-row">
          <input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="New subtopic name" />
          <button className="primary" onClick={() => { if (subName.trim()) { store.addSubtopic(topicId, subName.trim()); setSubName(""); toast("Subtopic added"); } }}>Add</button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head"><h3>Add learning unit</h3><span className="chip">{unitsCount} units · {questionsCount} questions</span></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <select value={subForUnit} onChange={(e) => setSubForUnit(e.target.value)}>
            <option value="">No specific subtopic</option>
            {subtopics.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={unitType} onChange={(e) => setUnitType(e.target.value as UnitType)}>
            {(Object.keys(unitTypeLabel) as UnitType[]).map((t) => <option key={t} value={t}>{unitTypeLabel[t]}</option>)}
          </select>
          <input value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} placeholder="Unit title" />
          <textarea value={unitBody} onChange={(e) => setUnitBody(e.target.value)} placeholder="Write the explanation, example or instructions..." style={{ minHeight: 120 }} />
          <button className="primary" onClick={() => {
            if (!unitTitle.trim() || !unitBody.trim()) return;
            store.addLearningUnit(topicId, subForUnit || null, unitTitle.trim(), unitBody.trim(), unitType);
            setUnitTitle(""); setUnitBody(""); setSubForUnit("");
            toast("Learning unit added");
          }}>Save unit</button>
        </div>
      </div>
    </div>
  );
}
