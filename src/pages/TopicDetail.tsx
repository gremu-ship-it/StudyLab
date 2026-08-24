// Topic detail: objectives, concepts, units, questions, resources,
// materials, prerequisites — and the launch/resume Learning Session action.

import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Clock,
  FlaskConical,
  ListChecks,
  PlayCircle,
  Plus,
  Target,
  Upload,
} from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import {
  buildSessionPlan,
} from "../lib/session";
import {
  Button,
  Card,
  ErrorNote,
  Field,
  MasteryBadge,
  Modal,
  Progress,
  SectionHead,
  Select,
  SourceBadge,
  Spinner,
} from "../components/ui";
import { Link, navigate } from "../router";
import type { Concept, Course, LearningUnit, Question, Topic, UnitType } from "../types";

export function TopicDetail({ topic, course }: { topic: Topic; course?: Course }) {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;

  const objectivesQ = useQuery(() => api.getObjectives(topic.id), [topic.id]);
  const conceptsQ = useQuery(() => api.getConcepts(topic.id), [topic.id]);
  const unitsQ = useQuery(() => api.getUnits(topic.id), [topic.id]);
  const questionsQ = useQuery(
    () => api.getQuestions(topic.id, { includeOwnDrafts: true, userId: user?.id }),
    [topic.id, user?.id],
  );
  const practicalsQ = useQuery(() => api.getPracticals(topic.id), [topic.id]);
  const resourcesQ = useQuery(() => api.getResourcesForTopics([topic.id]), [topic.id]);
  const materialsQ = useQuery(() => api.getMaterials(), []);
  const sessionQ = useQuery(() => api.getActiveSession(topic.id), [topic.id]);
  const masteryQ = useQuery(api.getTopicMastery, []);
  const courseTopicsQ = useQuery(() => api.getTopics(topic.course_id), [topic.course_id]);
  const prereqsQ = useQuery(() => api.getTopicPrerequisites(topic.id), [topic.id]);

  const [modal, setModal] = useState<null | "topic" | "objective" | "concept" | "unit" | "question" | "prereq">(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const mastery = masteryQ.data?.find((m) => m.topic_id === topic.id);
  const myMaterials = useMemo(
    () => (materialsQ.data ?? []).filter((m) => m.topic_id === topic.id),
    [materialsQ.data, topic.id],
  );

  async function startSession() {
    if (!user) return;
    setCreating(true);
    setCreateError(null);
    try {
      const existing = await api.getActiveSession(topic.id);
      if (existing) {
        navigate(`/session/${existing.id}`);
        return;
      }
      const [units, questions, practicals, objectives] = [
        unitsQ.data ?? [],
        questionsQ.data ?? [],
        practicalsQ.data ?? [],
        objectivesQ.data ?? [],
      ];
      const plan = buildSessionPlan({
        topicName: topic.name,
        units: units.filter((u) => u.status !== "draft"),
        questions: questions.filter((q) => q.status !== "draft"),
        practicals: practicals.filter((p) => p.status !== "draft"),
        objectives,
      });
      if (plan.steps.length <= 2) {
        setCreateError(
          "This topic needs at least one learning unit, question, practical or objective before a session can be built. Add content below (or upload material).",
        );
        return;
      }
      const session = await api.createSessionWithSteps(
        {
          student_id: user.id,
          topic_id: topic.id,
          title: `Learn ${topic.name}`,
          study_session_id: null,
          status: "active",
          current_step: 0,
          difficulty_floor: null,
          diagnostic_score: null,
          started_at: new Date().toISOString(),
          completed_at: null,
          settings: {},
        },
        plan.steps.map((s) => ({
          learning_unit_id: s.unit?.id ?? null,
          question_id: s.question?.id ?? null,
          practical_id: s.practical?.id ?? null,
          step_number: s.number,
          step_type: s.stepType,
          title: s.title,
          status: "locked",
          completed_at: null,
          score: null,
          duration_seconds: null,
          metadata: s.objectives ? { objective_ids: s.objectives.map((o) => o.id), objective_statements: s.objectives.map((o) => o.statement) } : {},
        })),
      );
      navigate(`/session/${session.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  if (sessionQ.loading || unitsQ.loading || questionsQ.loading) {
    return (
      <div className="page">
        <Spinner label="Loading topic…" />
      </div>
    );
  }

  const activeSession = sessionQ.data;
  const prerequisites = (prereqsQ.data ?? []).filter((r) => r.to_topic_id === topic.id);
  const enables = (prereqsQ.data ?? []).filter((r) => r.from_topic_id === topic.id);
  const topicName = (id: string) => (courseTopicsQ.data ?? []).find((t) => t.id === id)?.name ?? "?";

  return (
    <section className="page">
      <Link to={`/courses/${topic.course_id}`} className="back-link">
        ← {course?.name ?? "Course"}
      </Link>
      <div className="page-heading topic-heading">
        <div>
          <span className="eyebrow">
            {course?.code ?? ""} {course?.name ? `· ${course.name}` : ""}
          </span>
          <h1>{topic.name}</h1>
          <p>{topic.description ?? "A structured topic: objectives, concepts, content, practice and mastery."}</p>
          <div className="topic-badges">
            {mastery ? <MasteryBadge level={mastery.mastery_level} score={mastery.mastery_score} /> : <MasteryBadge level="not_assessed" />}
            {topic.estimated_minutes && (
              <span className="tag">
                <Clock size={12} /> ~{topic.estimated_minutes} min
              </span>
            )}
            {prerequisites.length > 0 && (
              <span className="tag amber">needs: {prerequisites.map((r) => topicName(r.from_topic_id)).join(", ")}</span>
            )}
            {enables.length > 0 && (
              <span className="tag green">enables: {enables.map((r) => topicName(r.to_topic_id)).join(", ")}</span>
            )}
          </div>
        </div>
        <div className="topic-actions">
          {activeSession ? (
            <Button onClick={() => navigate(`/session/${activeSession.id}`)}>
              <PlayCircle size={16} /> Resume session
            </Button>
          ) : (
            <Button onClick={startSession} disabled={creating}>
              <PlayCircle size={16} /> {creating ? "Preparing…" : "Start learning session"}
            </Button>
          )}
        </div>
      </div>

      {createError && <ErrorNote message={createError} />}

      {/* Objectives */}
      <SectionHead
        title="Learning objectives"
        sub="What you will be able to do after this topic"
        action={
          <Button variant="secondary" onClick={() => setModal("objective")}>
            <Plus size={14} /> Add
          </Button>
        }
      />
      <Card className="objectives-card">
        {(objectivesQ.data ?? []).length === 0 ? (
          <p className="muted">No objectives yet — add what "understanding this" should mean for you.</p>
        ) : (
          <ul className="objective-list">
            {(objectivesQ.data ?? []).map((o) => (
              <li key={o.id}>
                <ListChecks size={15} /> {o.statement}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Concepts */}
      <SectionHead
        title="Concepts"
        sub="The building blocks the mastery engine tracks individually"
        action={
          <Button variant="secondary" onClick={() => setModal("concept")}>
            <Plus size={14} /> Add concept
          </Button>
        }
      />
      {(conceptsQ.data ?? []).length === 0 ? (
        <p className="muted">No concepts yet.</p>
      ) : (
        <div className="concept-grid">
          {(conceptsQ.data ?? []).map((c) => (
            <ConceptCard key={c.id} concept={c} />
          ))}
        </div>
      )}

      {/* Learning units */}
      <SectionHead
        title="Learning content"
        sub="Explanations, definitions, worked examples and video notes that make up the session"
        action={
          <Button variant="secondary" onClick={() => setModal("unit")}>
            <Plus size={14} /> Add unit
          </Button>
        }
      />
      {(unitsQ.data ?? []).length === 0 ? (
        <p className="muted">No content units yet — add explanations or upload material.</p>
      ) : (
        <div className="unit-list">
          {(unitsQ.data ?? []).map((u) => (
            <Card key={u.id} className="unit-card">
              <span className={`unit-type ${u.unit_type.replace(/_/g, "-")}`}>{u.unit_type.replace(/_/g, " ")}</span>
              <h3>{u.title}</h3>
              {u.body && <p className="unit-body">{u.body.slice(0, 220)}{u.body.length > 220 ? "…" : ""}</p>}
              {u.formula && <code className="formula">{u.formula}</code>}
            </Card>
          ))}
        </div>
      )}

      {/* Questions */}
      <SectionHead
        title="Practice & diagnostic questions"
        sub="Used in the session's guided practice, application and assessment steps"
        action={
          <Button variant="secondary" onClick={() => setModal("question")}>
            <Plus size={14} /> Add question
          </Button>
        }
      />
      {(questionsQ.data ?? []).length === 0 ? (
        <p className="muted">No questions yet.</p>
      ) : (
        <div className="q-bank">
          {(questionsQ.data ?? []).map((q) => (
            <div key={q.id} className="q-bank-row">
              <span className="tag">{q.question_type.replace(/_/g, " ")}</span>
              <span className="tag">d{q.difficulty}</span>
              {q.is_diagnostic && <span className="tag blue">diagnostic</span>}
              <span className="q-bank-text">{q.question_text.slice(0, 90)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Practicals */}
      <SectionHead title="Practical activities" sub="Hands-on work for this topic" />
      {(practicalsQ.data ?? []).length === 0 ? (
        <p className="muted">No practicals yet.</p>
      ) : (
        <div className="weak-list">
          {(practicalsQ.data ?? []).map((p) => (
            <Card key={p.id} className="weak-card">
              <div>
                <span><FlaskConical size={12} /> practical</span>
                <h3>{p.title}</h3>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Materials */}
      <SectionHead
        title="Course material"
        sub="Lecture notes and slides you uploaded for this topic (source level 1)"
        action={
          <Link to={`/materials?topic=${topic.id}`} className="text-btn">
            <Upload size={14} /> Upload material
          </Link>
        }
      />
      {myMaterials.length === 0 ? (
        <p className="muted">
          Nothing uploaded for this topic yet. Upload PDF/Word/PowerPoint or text notes — extraction runs server-side and never modifies the original file.
        </p>
      ) : (
        <div className="weak-list">
          {myMaterials.map((m) => (
            <Card key={m.id} className="weak-card">
              <div>
                <span>{m.processing_status}</span>
                <h3>{m.file_name}</h3>
              </div>
              <Link to="/materials" className="text-btn">
                View <ChevronRight size={14} />
              </Link>
            </Card>
          ))}
        </div>
      )}

      {/* Resources */}
      <SectionHead title="Resources" sub="External academic sources linked to this topic" />
      {(resourcesQ.data?.resources ?? []).length === 0 ? (
        <p className="muted">
          No resources linked — add them from the course workspace (Resources tab) or here later.
        </p>
      ) : (
        <div className="resource-list">
          {(resourcesQ.data?.resources ?? []).map((r) => (
            <Card key={r.id} className="resource-card">
              <div className="resource-main">
                <div className="resource-title-line">
                  <h3>{r.title}</h3>
                  <SourceBadge level={r.source_level} />
                </div>
              </div>
              {r.url && (
                <a className="text-btn" href={r.url} target="_blank" rel="noreferrer">
                  Open <ExternalLinkInline />
                </a>
              )}
            </Card>
          ))}
        </div>
      )}

      {modal === "topic" && null}
      {modal === "objective" && user && <AddObjectiveModal topic={topic} userId={user.id} onClose={() => setModal(null)} onSaved={objectivesQ.refresh} />}
      {modal === "concept" && user && <AddConceptModal topic={topic} userId={user.id} onClose={() => setModal(null)} onSaved={conceptsQ.refresh} />}
      {modal === "unit" && user && <AddUnitModal topic={topic} userId={user.id} onClose={() => setModal(null)} onSaved={unitsQ.refresh} />}
      {modal === "question" && user && <AddQuestionModal topic={topic} concepts={conceptsQ.data ?? []} userId={user.id} onClose={() => setModal(null)} onSaved={questionsQ.refresh} />}
      {modal === "prereq" && (
        <AddPrerequisiteModal
          topic={topic}
          allTopics={(courseTopicsQ.data ?? []).filter((t) => t.id !== topic.id)}
          onClose={() => setModal(null)}
          onSaved={prereqsQ.refresh}
        />
      )}
      <div className="topic-prereq-actions">
        <Button variant="ghost" onClick={() => setModal("prereq")}>
          <Target size={14} /> Manage prerequisites
        </Button>
      </div>
    </section>
  );
}

function ExternalLinkInline() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function ConceptCard({ concept }: { concept: Concept }) {
  return (
    <Card className="concept-card">
      <h3>{concept.name}</h3>
      {concept.definition && <p className="mut small">{concept.definition}</p>}
      {concept.formula && <code className="formula">{concept.formula}</code>}
      {concept.description && !concept.definition && <p className="mut small">{concept.description}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------

function AddObjectiveModal({ topic, userId, onClose, onSaved }: { topic: Topic; userId: string; onClose: () => void; onSaved: () => void }) {
  const [statement, setStatement] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!statement.trim()) return;
    try {
      await api.addObjective({ topic_id: topic.id, statement: statement.trim(), created_by: userId });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Modal title="Add a learning objective" onClose={onClose}>
      <Field label="Objective" value={statement} onChange={setStatement} rows={2} placeholder="e.g. Differentiate polynomial functions and interpret the derivative as a rate of change" />
      {error && <ErrorNote message={error} />}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Add</Button>
      </div>
    </Modal>
  );
}

function AddConceptModal({ topic, userId, onClose, onSaved }: { topic: Topic; userId: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [definition, setDefinition] = useState("");
  const [formula, setFormula] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!name.trim()) return;
    try {
      await api.addConcept({
        topic_id: topic.id,
        name: name.trim(),
        definition: definition.trim() || null,
        formula: formula.trim() || null,
        created_by: userId,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Modal title="Add a concept" onClose={onClose}>
      <p className="muted">Concepts are tracked individually in the mastery engine — keep them small and precise.</p>
      <Field label="Name" value={name} onChange={setName} placeholder="e.g. Derivative" />
      <Field label="One-sentence definition (optional)" value={definition} onChange={setDefinition} rows={2} />
      <Field label="Formula (optional)" value={formula} onChange={setFormula} placeholder="f′(x) = lim h→0 …" />
      {error && <ErrorNote message={error} />}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Add concept</Button>
      </div>
    </Modal>
  );
}

const UNIT_TYPES: { value: UnitType; label: string }[] = [
  { value: "explanation", label: "Explanation" },
  { value: "worked_example", label: "Worked example" },
  { value: "practice", label: "Guided practice note" },
  { value: "video", label: "Video note" },
  { value: "reflection", label: "Reflection prompt" },
  { value: "review", label: "Review note" },
];

function AddUnitModal({ topic, userId, onClose, onSaved }: { topic: Topic; userId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<UnitType>("explanation");
  const [body, setBody] = useState("");
  const [formula, setFormula] = useState("");
  const [minutes, setMinutes] = useState("10");
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!title.trim()) return;
    try {
      await api.addUnit({
        topic_id: topic.id,
        title: title.trim(),
        unit_type: type,
        body: body.trim() || null,
        formula: formula.trim() || null,
        estimated_minutes: minutes ? parseInt(minutes, 10) : null,
        created_by: userId,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Modal title="Add a learning unit" onClose={onClose} wide>
      <p className="muted">Units are the content blocks your session plays in sequence. Source level 1 (your material) applies to student-added units.</p>
      <div className="field-row">
        <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. The limit definition of the derivative" />
        <Select
          label="Type"
          value={type}
          onChange={(v) => setType(v as UnitType)}
          options={UNIT_TYPES}
        />
      </div>
      <Field label="Content (plain text / light markup)" value={body} onChange={setBody} rows={5} placeholder="Explain the idea, show the reasoning step by step…" />
      <div className="field-row">
        <Field label="Formula (optional)" value={formula} onChange={setFormula} />
        <Field label="Minutes (optional)" value={minutes} onChange={setMinutes} type="number" />
      </div>
      {error && <ErrorNote message={error} />}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Add unit</Button>
      </div>
    </Modal>
  );
}

function AddQuestionModal({
  topic,
  concepts,
  userId,
  onClose,
  onSaved,
}: {
  topic: Topic;
  concepts: Concept[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState<Question["question_type"]>("multiple_choice");
  const [difficulty, setDifficulty] = useState("1");
  const [isDiagnostic, setIsDiagnostic] = useState(false);
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctKey, setCorrectKey] = useState("A");
  const [numeric, setNumeric] = useState("");
  const [unit, setUnit] = useState("");
  const [keywords, setKeywords] = useState("");
  const [explanation, setExplanation] = useState("");
  const [hint1, setHint1] = useState("");
  const [guiding, setGuiding] = useState("");
  const [conceptId, setConceptId] = useState("");
  const [error, setError] = useState<string | null>(null);

  function buildCorrectAnswer(): unknown {
    switch (type) {
      case "multiple_choice":
        return { option_key: correctKey };
      case "true_false":
        return { value: correctKey === "T" };
      case "numeric": {
        const v = parseFloat(numeric);
        return { value: isFinite(v) ? v : 0, unit: unit.trim() || undefined };
      }
      case "short_answer":
      case "scenario":
        return { keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) };
      default:
        return {};
    }
  }

  async function save() {
    if (!text.trim()) return;
    try {
      await api.addQuestion({
        topic_id: topic.id,
        question_type: type,
        difficulty: Math.max(1, Math.min(5, parseInt(difficulty, 10) || 1)),
        question_text: text.trim(),
        correct_answer: buildCorrectAnswer(),
        explanation: explanation.trim() || null,
        hint_1: hint1.trim() || null,
        is_diagnostic: isDiagnostic,
        scaffolding: guiding.trim() ? { guiding_question: guiding.trim() } : {},
        concept_id: conceptId || null,
        created_by: userId,
        options:
          type === "multiple_choice"
            ? options
                .map((o, i) => ({ option_key: String.fromCharCode(65 + i), option_text: o.trim() }))
                .filter((o) => o.option_text)
            : undefined,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const mcReady = options.filter((o) => o.trim()).length >= 2;
  const numericReady = type === "numeric" ? isFinite(parseFloat(numeric)) && numeric.trim() !== "" : true;
  const ready = text.trim() && (type === "multiple_choice" ? mcReady : numericReady);

  return (
    <Modal title="Add a question" onClose={onClose} wide>
      <Field label="Question" value={text} onChange={setText} rows={2} placeholder="What should the student work out?" />
      <div className="field-row">
        <Select
          label="Type"
          value={type}
          onChange={(v) => setType(v as Question["question_type"])}
          options={[
            { value: "multiple_choice", label: "Multiple choice" },
            { value: "true_false", label: "True / false" },
            { value: "numeric", label: "Numeric" },
            { value: "short_answer", label: "Short answer" },
            { value: "scenario", label: "Application / case" },
          ]}
        />
        <Select
          label="Difficulty"
          value={difficulty}
          onChange={setDifficulty}
          options={[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `Level ${d}${d <= 2 ? " (practice)" : d >= 3 ? " (application)" : ""}` }))}
        />
      </div>

      {type === "multiple_choice" && (
        <div className="opt-edit">
          {options.map((o, i) => (
            <div className="opt-edit-row" key={i}>
              <label className={correctKey === String.fromCharCode(65 + i) ? "pick active" : "pick"}>
                <input type="radio" name="correct" checked={correctKey === String.fromCharCode(65 + i)} onChange={() => setCorrectKey(String.fromCharCode(65 + i))} />
                {String.fromCharCode(65 + i)}
              </label>
              <input value={o} onChange={(e) => setOptions((os) => os.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Option ${String.fromCharCode(65 + i)}`} />
            </div>
          ))}
          <small className="field-hint">Select the radio for the correct option.</small>
        </div>
      )}

      {type === "true_false" && (
        <Select
          label="Correct statement"
          value={correctKey === "T" ? "T" : "F"}
          onChange={(v) => setCorrectKey(v)}
          options={[
            { value: "T", label: "True" },
            { value: "F", label: "False" },
          ]}
        />
      )}

      {type === "numeric" && (
        <div className="field-row">
          <Field label="Correct value" value={numeric} onChange={setNumeric} placeholder="e.g. 9.8" />
          <Field label="Unit (optional)" value={unit} onChange={setUnit} placeholder="m/s²" />
        </div>
      )}

      {(type === "short_answer" || type === "scenario") && (
        <Field label="Key ideas (comma separated)" value={keywords} onChange={setKeywords} placeholder="momentum, mass, velocity" hint="Used for automatic grading — keep 3-5 concise phrases." />
      )}

      <Field label="Explanation / why it works (shown after solving)" value={explanation} onChange={setExplanation} rows={2} />
      <div className="field-row">
        <Field label="Hint 1 (optional)" value={hint1} onChange={setHint1} />
        <Field label="Guiding question (optional)" value={guiding} onChange={setGuiding} />
      </div>
      {concepts.length > 0 && (
        <Select
          label="Concept (optional)"
          value={conceptId}
          onChange={setConceptId}
          options={[{ value: "", label: "—" }, ...concepts.map((c) => ({ value: c.id, label: c.name }))]}
        />
      )}
      <label className="pick">
        <input type="checkbox" checked={isDiagnostic} onChange={(e) => setIsDiagnostic(e.target.checked)} />
        Use as the session's diagnostic question
      </label>
      {error && <ErrorNote message={error} />}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!ready}>
          Add question
        </Button>
      </div>
    </Modal>
  );
}

function numericOk(v: string, type: Question["question_type"]): boolean {
  return type === "numeric" ? v.trim() !== "" : true;
}

function AddPrerequisiteModal({
  topic,
  allTopics,
  onClose,
  onSaved,
}: {
  topic: Topic;
  allTopics: Topic[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!from) return;
    try {
      // "from" must be mastered before "topic"
      await api.addTopicPrerequisite(from, topic.id);
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return (
    <Modal title="Add a prerequisite" onClose={onClose}>
      <p className="muted">“{topic.name}” requires this other topic to be solid first. The recommendation engine uses this to order your study.</p>
      <Select
        label="Required topic"
        value={from}
        onChange={setFrom}
        options={[{ value: "", label: "Choose…" }, ...allTopics.map((t) => ({ value: t.id, label: t.name }))]}
      />
      {error && <ErrorNote message={error} />}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!from}>Add prerequisite</Button>
      </div>
    </Modal>
  );
}
