// Completely redesigned Topic Detail page built around MASTERY.
//
// Structure:
//   1. Progress Header & Time Remaining
//   2. YOUR LEARNING PATH (01 Foundations → ... → 10 Mastery assessment)
//   3. WHAT YOU WILL LEARN (Measurable, assessable objectives)
//   4. CONCEPT MAP (Interactive visual DAG with mastery colours)
//   5. LEARN (Structured lessons with Intuition, Formal Definition, Worked Examples, Common Pitfalls)
//   6. READ (Textbooks & Lecture Notes with citations)
//   7. WATCH (Curated educational video lessons)
//   8. PRACTICE (Progressive Practice Levels 1 to 5)
//   9. APPLY (Domain application problems)
//   10. PRACTICAL (Hands-on activities & simulations)
//   11. CHECK YOUR MASTERY (Assessment & Spaced Repetition)
//   12. NEED HELP? (Contextual AI Tutor integration)

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FlaskConical,
  GraduationCap,
  Layers,
  Lightbulb,
  ListChecks,
  PlayCircle,
  Plus,
  Repeat,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Upload,
  Video,
} from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import { buildSessionPlan } from "../lib/session";
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
import type { Concept, Course, LearningObjective, LearningUnit, Practical, Question, QuestionOption, Resource, Topic, TopicMastery, UnitType } from "../types";
import { ALL_BLUEPRINTS } from "../lib/curriculum-data";
import { LearningPath, type PathNode } from "../components/LearningPath";
import { ConceptMap } from "../components/ConceptMap";
import { StructuredLessonViewer } from "../components/StructuredLessonViewer";
import { ProgressivePractice } from "../components/ProgressivePractice";
import { ResourceHub } from "../components/ResourceHub";
import { MasteryAssessmentPanel } from "../components/MasteryAssessmentPanel";
import { ActivityRunner } from "../components/ActivityRunner";
import { listActivities } from "../lib/practical-activities";

export function TopicDetail({ topic, course }: { topic: Topic; course?: Course }) {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;

  // Check if we have a curated blueprint for this topic
  const blueprint = useMemo(
    () => ALL_BLUEPRINTS.find((b) => b.topic.id === topic.id || b.topic.name.toLowerCase() === topic.name.toLowerCase()),
    [topic.id, topic.name],
  );

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
  const masteryQ = useQuery(api.getTopicMastery, [user?.id]);
  const conceptMasteryQ = useQuery(api.getConceptMastery, [user?.id]);
  const courseTopicsQ = useQuery(() => api.getTopics(topic.course_id), [topic.course_id]);
  const prereqsQ = useQuery(() => api.getTopicPrerequisites(topic.id), [topic.id]);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeSectionTab, setActiveSectionTab] = useState<"learn" | "practice" | "apply" | "practical" | "resources" | "assess">("learn");

  // Merge DB data with blueprint fallback so students NEVER see "No objectives yet"
  const objectives: LearningObjective[] = useMemo(() => {
    const dbData = objectivesQ.data ?? [];
    if (dbData.length > 0) return dbData;
    return blueprint?.objectives ?? [];
  }, [objectivesQ.data, blueprint]);

  const concepts: Concept[] = useMemo(() => {
    const dbData = conceptsQ.data ?? [];
    if (dbData.length > 0) return dbData;
    return blueprint?.concepts ?? [];
  }, [conceptsQ.data, blueprint]);

  const units: LearningUnit[] = useMemo(() => {
    const dbData = unitsQ.data ?? [];
    if (dbData.length > 0) return dbData;
    return blueprint?.units ?? [];
  }, [unitsQ.data, blueprint]);

  const questions: Question[] = useMemo(() => {
    const dbData = questionsQ.data ?? [];
    if (dbData.length > 0) return dbData;
    return blueprint?.questions ?? [];
  }, [questionsQ.data, blueprint]);

  const options: QuestionOption[] = useMemo(() => {
    return blueprint?.options ?? [];
  }, [blueprint]);

  const resources: Resource[] = useMemo(() => {
    const dbResources = resourcesQ.data?.resources ?? [];
    if (dbResources.length > 0) return dbResources;
    return blueprint?.resources ?? [];
  }, [resourcesQ.data, blueprint]);

  const practicals: Practical[] = useMemo(() => {
    const dbData = practicalsQ.data ?? [];
    if (dbData.length > 0) return dbData;
    return (blueprint?.practicals ?? []).map((p) => p.practical);
  }, [practicalsQ.data, blueprint]);

  const mastery = (masteryQ.data ?? []).find((m) => m.topic_id === topic.id);
  const conceptMasteryList = conceptMasteryQ.data ?? [];

  // Calculate learning progress & time remaining
  const progressPercent = useMemo(() => {
    if (mastery && mastery.mastery_score > 0) return Math.min(100, mastery.mastery_score);
    if (sessionQ.data) return Math.min(100, Math.max(10, sessionQ.data.current_step * 12));
    return 0;
  }, [mastery, sessionQ.data]);

  const estimatedMinutes = topic.estimated_minutes ?? 180;
  const estimatedRemainingMinutes = Math.max(15, Math.round(estimatedMinutes * (1 - progressPercent / 100)));

  // Build the 10-step visual Learning Path
  const pathNodes: PathNode[] = useMemo(() => {
    const steps: PathNode[] = [];
    let stepNum = 1;

    // 1. Overview & Foundations
    steps.push({
      number: stepNum++,
      title: "Foundations & Overview",
      stepType: "Foundations",
      status: progressPercent > 10 ? "completed" : "current",
      estimatedMinutes: 15,
      description: "Why this topic matters and key prerequisite connections.",
    });

    // 2-6. Core structured units
    for (const u of units.slice(0, 5)) {
      const isDone = progressPercent >= (stepNum * 10);
      const isCurrent = !isDone && progressPercent >= ((stepNum - 1) * 10);
      steps.push({
        number: stepNum++,
        title: u.title,
        stepType: u.unit_type,
        status: isDone ? "completed" : isCurrent ? "current" : "locked",
        estimatedMinutes: u.estimated_minutes ?? 20,
        description: u.description ?? undefined,
      });
    }

    // 7. Progressive Practice
    steps.push({
      number: stepNum++,
      title: "Progressive Practice (Levels 1–3)",
      stepType: "Practice",
      status: progressPercent >= 60 ? "completed" : progressPercent >= 50 ? "current" : "locked",
      estimatedMinutes: 30,
      description: "Recognition, basic procedural application, and multi-step problems.",
    });

    // 8. Application Problems
    steps.push({
      number: stepNum++,
      title: "Application & Transfer (Levels 4–5)",
      stepType: "Application",
      status: progressPercent >= 80 ? "completed" : progressPercent >= 65 ? "current" : "locked",
      estimatedMinutes: 25,
      description: "Real-world domain models and experimental interpretations.",
    });

    // 9. Practical Activity
    steps.push({
      number: stepNum++,
      title: "Practical Investigation",
      stepType: "Practical",
      status: progressPercent >= 90 ? "completed" : progressPercent >= 75 ? "current" : "locked",
      estimatedMinutes: 25,
      description: "Hands-on data collection, simulation, and analysis.",
    });

    // 10. Mastery Assessment
    steps.push({
      number: stepNum++,
      title: "Mastery Assessment",
      stepType: "Assessment",
      status: progressPercent >= 95 ? "completed" : "locked",
      estimatedMinutes: 30,
      description: "Final comprehensive evaluation to demonstrate mastery.",
    });

    return steps;
  }, [units, progressPercent]);

  // Launch Learning Session
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

      const plan = buildSessionPlan({
        topicName: topic.name,
        units: units.filter((u) => u.status !== "draft"),
        questions: questions.filter((q) => q.status !== "draft"),
        practicals: practicals.filter((p) => p.status !== "draft"),
        objectives,
      });

      if (plan.steps.length <= 2) {
        setCreateError("This topic needs learning units or practice items to build a session.");
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
          metadata: s.objectives
            ? { objective_ids: s.objectives.map((o) => o.id), objective_statements: s.objectives.map((o) => o.statement) }
            : {},
        })),
      );
      navigate(`/session/${session.id}`);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  }

  // Application-only questions (difficulty 4-5)
  const applicationQuestions = useMemo(() => questions.filter((q) => q.difficulty >= 4), [questions]);
  // Readings (Textbooks + Notes)
  const readingResources = useMemo(() => resources.filter((r) => r.resource_type === "textbook" || r.resource_type === "website" || r.category === "open_textbooks"), [resources]);
  // Videos
  const videoResources = useMemo(() => resources.filter((r) => r.resource_type === "youtube" || r.category === "videos"), [resources]);

  return (
    <section className="page topic-detail-mastery-page">
      {/* Back Link */}
      <Link to={`/courses/${topic.course_id}`} className="back-link">
        ← Back to {course?.name ?? "Course"}
      </Link>

      {/* TOPIC HEADER */}
      <div className="topic-mastery-hero">
        <div className="hero-main-content">
          <div className="hero-eyebrow-row">
            <span className="eyebrow">{course?.code ?? "COURSE"} · {course?.name ?? "Natural & Applied Sciences"}</span>
            {mastery ? (
              <MasteryBadge level={mastery.mastery_level} score={mastery.mastery_score} />
            ) : (
              <MasteryBadge level="not_assessed" />
            )}
          </div>
          <h1>{topic.name}</h1>
          <p className="topic-hero-description">
            {topic.overview ?? topic.description ?? "Master foundational concepts, mathematical definitions, multi-step problem solving, and real-world applications."}
          </p>

          {topic.why_it_matters && (
            <div className="why-it-matters-banner">
              <Sparkles size={16} className="sparkle" />
              <div>
                <strong>Why this topic matters:</strong>
                <p>{topic.why_it_matters}</p>
              </div>
            </div>
          )}

          <div className="topic-meta-strip">
            <span className="meta-tag">
              <Clock size={13} /> Estimated: {topic.estimated_minutes ?? 180} min
            </span>
            <span className="meta-tag">
              <Target size={13} /> {concepts.length} Key Concepts
            </span>
            <span className="meta-tag">
              <ListChecks size={13} /> {objectives.length} Measurable Objectives
            </span>
            {topic.prerequisites_summary && (
              <span className="meta-tag amber">
                Prerequisites: {topic.prerequisites_summary}
              </span>
            )}
          </div>
        </div>

        <div className="hero-action-panel">
          <div className="progress-summary-card">
            <div className="progress-top-label">
              <span>Overall Progress</span>
              <strong>{progressPercent}%</strong>
            </div>
            <div className="progress">
              <i style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="remaining-time-text">
              <Clock size={12} /> ~{Math.floor(estimatedRemainingMinutes / 60)}h {estimatedRemainingMinutes % 60}m remaining
            </span>

            {sessionQ.data ? (
              <button className="primary hero-action-btn" onClick={() => navigate(`/session/${sessionQ.data!.id}`)}>
                <PlayCircle size={16} /> Resume Learning Session
              </button>
            ) : (
              <button className="primary hero-action-btn" onClick={startSession} disabled={creating}>
                <PlayCircle size={16} /> {creating ? "Preparing Session…" : "Start Learning Session"}
              </button>
            )}
          </div>
        </div>
      </div>

      {createError && <ErrorNote message={createError} />}

      {/* 1. YOUR LEARNING PATH */}
      <LearningPath
        nodes={pathNodes}
        progressPercent={progressPercent}
        estimatedRemainingMinutes={estimatedRemainingMinutes}
        activeSession={sessionQ.data}
        onStartSession={startSession}
      />

      {/* 2. WHAT YOU WILL LEARN */}
      <div className="topic-section-card objectives-section">
        <SectionHead
          title="What You Will Learn"
          sub="Measurable learning objectives aligned with LUANAR curriculum benchmarks"
        />
        <div className="objectives-grid">
          {objectives.map((obj, i) => (
            <div key={obj.id} className="objective-item-card">
              <div className="obj-index">{String(i + 1).padStart(2, "0")}</div>
              <div className="obj-text-wrap">
                <p className="obj-statement">{obj.statement}</p>
                {obj.criteria && (
                  <span className="obj-criteria">
                    <strong>Assessable criteria:</strong> {obj.criteria}
                  </span>
                )}
              </div>
              {obj.bloom_level && (
                <span className={`bloom-badge bloom-${obj.bloom_level}`}>
                  {obj.bloom_level}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. CONCEPT MAP */}
      <div className="topic-section-card concept-map-section">
        <ConceptMap
          concepts={concepts}
          prerequisites={blueprint?.prerequisites ?? []}
          masteryList={conceptMasteryList}
          onPracticeConcept={(cid) => {
            setActiveSectionTab("practice");
            const el = document.getElementById("practice-section");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
          onAskTutor={(c) => navigate(`/tutor?topic=${topic.id}&concept=${c.id}`)}
        />
      </div>

      {/* TOPIC CORE NAVIGATION TABS */}
      <div className="topic-content-tabs-nav">
        <button
          className={`content-nav-btn ${activeSectionTab === "learn" ? "active" : ""}`}
          onClick={() => setActiveSectionTab("learn")}
        >
          <BookOpen size={16} /> Learn ({units.length})
        </button>
        <button
          className={`content-nav-btn ${activeSectionTab === "practice" ? "active" : ""}`}
          onClick={() => setActiveSectionTab("practice")}
        >
          <Target size={16} /> Progressive Practice ({questions.length})
        </button>
        <button
          className={`content-nav-btn ${activeSectionTab === "apply" ? "active" : ""}`}
          onClick={() => setActiveSectionTab("apply")}
        >
          <Sparkles size={16} /> Application Problems ({applicationQuestions.length})
        </button>
        <button
          className={`content-nav-btn ${activeSectionTab === "practical" ? "active" : ""}`}
          onClick={() => setActiveSectionTab("practical")}
        >
          <FlaskConical size={16} /> Practical Activities ({practicals.length || 1})
        </button>
        <button
          className={`content-nav-btn ${activeSectionTab === "resources" ? "active" : ""}`}
          onClick={() => setActiveSectionTab("resources")}
        >
          <Layers size={16} /> Resource Hub ({resources.length})
        </button>
        <button
          className={`content-nav-btn ${activeSectionTab === "assess" ? "active" : ""}`}
          onClick={() => setActiveSectionTab("assess")}
        >
          <Trophy size={16} /> Check Mastery
        </button>
      </div>

      {/* 4. LEARN (STRUCTURED LESSONS) */}
      {activeSectionTab === "learn" && (
        <div className="topic-tab-pane">
          <SectionHead
            title="Structured University Lessons"
            sub="Deep, step-by-step conceptual units with formal definitions, worked solutions, and error analyses."
          />
          <StructuredLessonViewer units={units} />

          {/* READ & WATCH SUB-SECTIONS */}
          <div className="read-watch-dual-grid">
            <div className="read-column">
              <div className="section-mini-head">
                <BookOpen size={18} />
                <h4>Recommended Reading & Lecture Notes</h4>
              </div>
              <div className="mini-res-list">
                {readingResources.slice(0, 3).map((r) => (
                  <Card key={r.id} className="mini-res-card">
                    <div className="mini-res-top">
                      <strong>{r.title}</strong>
                      <SourceBadge level={r.source_level as 1 | 2 | 3 | 4} />
                    </div>
                    {r.page_reference && <span className="mini-ref">{r.page_reference}</span>}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-btn">
                        Open <ExternalLink size={12} />
                      </a>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            <div className="watch-column">
              <div className="section-mini-head">
                <Video size={18} />
                <h4>Curated Video Lessons</h4>
              </div>
              <div className="mini-res-list">
                {videoResources.slice(0, 3).map((r) => (
                  <Card key={r.id} className="mini-res-card">
                    <div className="mini-res-top">
                      <strong>{r.title}</strong>
                      {r.duration_seconds && (
                        <span className="tag"><Clock size={11} /> {Math.round(r.duration_seconds / 60)} min</span>
                      )}
                    </div>
                    {r.description && <p className="small mut">{r.description.slice(0, 90)}…</p>}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-btn">
                        Watch <ExternalLink size={12} />
                      </a>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. PRACTICE (PROGRESSIVE PRACTICE) */}
      {activeSectionTab === "practice" && (
        <div id="practice-section" className="topic-tab-pane">
          <ProgressivePractice
            questions={questions}
            options={options}
            onAttempt={(q, res) => {
              if (user) {
                void api.recordQuestionAttempt({
                  student_id: user.id,
                  question_id: q.id,
                  answer: res.answer,
                  is_correct: res.correct,
                  score: res.score,
                  hints_used: res.hintsUsed,
                  attempt_number: 1,
                });
              }
            }}
          />
        </div>
      )}

      {/* 6. APPLY (APPLICATION PROBLEMS) */}
      {activeSectionTab === "apply" && (
        <div className="topic-tab-pane">
          <SectionHead
            title="University Application & Modelling Problems"
            sub="Transfer your conceptual and mathematical understanding to unfamiliar natural science scenarios."
          />
          <ProgressivePractice
            questions={applicationQuestions.length > 0 ? applicationQuestions : questions.filter((q) => q.difficulty >= 3)}
            options={options}
            onAttempt={(q, res) => {
              if (user) {
                void api.recordQuestionAttempt({
                  student_id: user.id,
                  question_id: q.id,
                  answer: res.answer,
                  is_correct: res.correct,
                  score: res.score,
                  hints_used: res.hintsUsed,
                  attempt_number: 1,
                });
              }
            }}
          />
        </div>
      )}

      {/* 7. PRACTICAL ACTIVITIES */}
      {activeSectionTab === "practical" && (
        <div className="topic-tab-pane">
          <SectionHead
            title="Hands-On Practical & Computational Labs"
            sub="Interactive simulations, observation tables, and data analysis tasks."
          />
          {practicals.length > 0 ? (
            <div className="practicals-full-list">
              {practicals.map((p) => (
                <Card key={p.id} className="practical-full-card">
                  <div className="pract-head">
                    <span className="type-pill"><FlaskConical size={14} /> Laboratory / Practical</span>
                    <h3>{p.title}</h3>
                  </div>
                  {p.objective && <p className="pract-objective"><strong>Objective:</strong> {p.objective}</p>}
                  {p.background && <p className="pract-bg">{p.background}</p>}

                  {/* Built-in interactive activity runner if available */}
                  <div className="activity-runner-embed">
                    <ActivityRunner
                      activity={listActivities()[0]}
                      onResult={() => {}}
                    />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="activity-runner-embed">
              <ActivityRunner
                activity={listActivities()[0]}
                onResult={() => {}}
              />
            </div>
          )}
        </div>
      )}

      {/* 8. RESOURCE HUB */}
      {activeSectionTab === "resources" && (
        <div className="topic-tab-pane">
          <ResourceHub resources={resources} />
        </div>
      )}

      {/* 9. CHECK YOUR MASTERY */}
      {activeSectionTab === "assess" && (
        <div className="topic-tab-pane">
          <MasteryAssessmentPanel
            assessment={blueprint?.assessments?.[0]}
            questions={questions}
            options={options}
            topicMastery={mastery}
            concepts={concepts}
            onCompleteAssessment={(score, passed) => {
              if (user) {
                void api.upsertTopicMastery({
                  student_id: user.id,
                  topic_id: topic.id,
                  mastery_score: score,
                  mastery_level: score >= 85 ? "mastered" : score >= 65 ? "strong" : score >= 40 ? "developing" : "weak",
                  confidence_score: 80,
                  attempt_count: (mastery?.attempt_count ?? 0) + 1,
                  last_assessed_at: new Date().toISOString(),
                  last_practiced_at: new Date().toISOString(),
                  next_review_at: new Date(Date.now() + 86400000 * 3).toISOString(),
                });
                masteryQ.refresh();
              }
            }}
          />
        </div>
      )}

      {/* 10. NEED HELP? CONTEXTUAL AI TUTOR */}
      <div className="tutor-callout-footer">
        <div className="tutor-footer-main">
          <div className="tutor-orb">
            <Brain size={30} />
          </div>
          <div>
            <h3>Need Help Masterering {topic.name}?</h3>
            <p>
              The AI Tutor knows your current progress, specific weak concepts, and course materials. It provides hints and guided analogies without dumping immediate answers.
            </p>
            <div className="prompt-chips-row">
              <button
                className="prompt-chip"
                onClick={() => navigate(`/tutor?topic=${topic.id}&task=explain_simply`)}
              >
                <Lightbulb size={13} /> Explain simply
              </button>
              <button
                className="prompt-chip"
                onClick={() => navigate(`/tutor?topic=${topic.id}&task=worked_example`)}
              >
                <Target size={13} /> Show worked solution
              </button>
              <button
                className="prompt-chip"
                onClick={() => navigate(`/tutor?topic=${topic.id}&task=why_wrong`)}
              >
                <AlertTriangle size={13} /> Find my misconception
              </button>
              <button
                className="prompt-chip"
                onClick={() => navigate(`/tutor?topic=${topic.id}&task=harder_problem`)}
              >
                <Trophy size={13} /> Give me a harder problem
              </button>
              <button
                className="prompt-chip"
                onClick={() => navigate(`/tutor?topic=${topic.id}&mode=feynman`)}
              >
                <Sparkles size={13} /> Feynman Explain-Back Test
              </button>
            </div>
          </div>
        </div>
        <button
          className="primary launch-tutor-btn"
          onClick={() => navigate(`/tutor?topic=${topic.id}`)}
        >
          <Brain size={16} /> Open Contextual Tutor
        </button>
      </div>
    </section>
  );
}
