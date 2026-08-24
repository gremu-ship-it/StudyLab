// Data access layer — every query/mutation the UI performs goes through here.
// When Supabase is configured, executes live PostgreSQL queries.
// When Supabase is not configured (or in demo mode), seamlessly provides full
// client-persisted university curriculum from authoritative blueprints.

import { supabase } from "./supabase";
import type {
  ActivityAttempt,
  AcademicPeriod,
  AssessmentAttempt,
  Assessment,
  AiConversation,
  AiMessage,
  Concept,
  ConceptMastery,
  ConceptPrerequisite,
  Course,
  Enrolment,
  ExplainBackAttempt,
  ExtractedItem,
  LearningObjective,
  LearningSession,
  LearningUnit,
  Practical,
  QuestionResult,
  PracticalStep,
  Programme,
  Question,
  QuestionOption,
  Recommendation,
  Resource,
  ReviewItem,
  SessionStep,
  Skill,
  StudentProfile,
  Subtopic,
  Topic,
  TopicMastery,
  UploadedMaterial,
} from "../types";
import { ALL_BLUEPRINTS, COURSES_SEED, PROGRAMMES_SEED } from "./curriculum-data";

export function isConfigured(): boolean {
  return supabase !== null;
}

function sb() {
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

export class ApiError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

function check<T>(result: { data: unknown; error: { message: string } | null }, fallback: T): T {
  if (result.error) throw new ApiError(result.error.message);
  return (result.data ?? fallback) as T;
}

// ---------------------------------------------------------------------------
// LocalStorage Store for Demo / Offline Resilience
// ---------------------------------------------------------------------------

const LOCAL_STORE_KEY = "studylab_client_store_v3";

interface LocalStore {
  sessions: LearningSession[];
  sessionSteps: SessionStep[];
  topicMastery: TopicMastery[];
  conceptMastery: ConceptMastery[];
  questionAttempts: {
    student_id: string;
    question_id: string;
    learning_session_id: string | null;
    answer: unknown;
    is_correct: boolean | null;
    score: number | null;
    hints_used: number;
    attempted_at: string;
  }[];
  reviews: ReviewItem[];
  recommendations: Recommendation[];
  uploadedMaterials: UploadedMaterial[];
  conversations: AiConversation[];
  messages: AiMessage[];
  explainBackAttempts: ExplainBackAttempt[];
  assessments: Assessment[];
  assessmentAttempts: AssessmentAttempt[];
  activityAttempts: ActivityAttempt[];
  customTopics: Topic[];
  customObjectives: LearningObjective[];
  customConcepts: Concept[];
  customUnits: LearningUnit[];
  customQuestions: Question[];
  customOptions: QuestionOption[];
}

function getLocalStore(): LocalStore {
  try {
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    if (raw) return JSON.parse(raw) as LocalStore;
  } catch {
    /* fallback to default */
  }
  return {
    sessions: [],
    sessionSteps: [],
    topicMastery: [
      {
        id: "tm-limits-demo",
        student_id: "demo-student-1",
        topic_id: "topic-limits",
        mastery_score: 32,
        mastery_level: "developing",
        confidence_score: 50,
        attempt_count: 3,
        last_practiced_at: new Date().toISOString(),
        last_assessed_at: null,
        next_review_at: new Date(Date.now() + 86400000 * 2).toISOString(),
      },
    ],
    conceptMastery: [
      {
        id: "cm-lim-1",
        student_id: "demo-student-1",
        concept_id: "c-lim-1",
        mastery_score: 85,
        mastery_level: "mastered",
        confidence_score: 80,
        attempt_count: 2,
        last_assessed_at: new Date().toISOString(),
      },
      {
        id: "cm-lim-5",
        student_id: "demo-student-1",
        concept_id: "c-lim-5",
        mastery_score: 45,
        mastery_level: "developing",
        confidence_score: 40,
        attempt_count: 1,
        last_assessed_at: new Date().toISOString(),
      },
    ],
    questionAttempts: [],
    reviews: [
      {
        id: "rev-limits-1",
        student_id: "demo-student-1",
        topic_id: "topic-limits",
        scheduled_for: new Date(Date.now() + 86400000).toISOString(),
        interval_days: 1,
        ease_factor: 2.5,
        status: "scheduled",
      },
    ],
    recommendations: [],
    uploadedMaterials: [],
    conversations: [],
    messages: [],
    explainBackAttempts: [],
    assessments: ALL_BLUEPRINTS.flatMap((b) => b.assessments),
    assessmentAttempts: [],
    activityAttempts: [],
    customTopics: [],
    customObjectives: [],
    customConcepts: [],
    customUnits: [],
    customQuestions: [],
    customOptions: [],
  };
}

function saveLocalStore(store: LocalStore) {
  try {
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore storage quotas */
  }
}

// ---------------------------------------------------------------------------
// Profile & onboarding
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<StudentProfile | null> {
  if (supabase) {
    return sb()
      .from("student_profiles")
      .select("*")
      .maybeSingle()
      .then((r) => check(r, null));
  }
  return {
    id: "demo-student-1",
    full_name: "Tiwonge Banda",
    institution_id: "inst-luanar",
    programme_id: "prog-nas",
    current_year: 2,
    current_semester: 1,
    timezone: "Africa/Blantyre",
    study_preferences: {},
  };
}

export async function upsertProfile(profile: Partial<StudentProfile> & { id: string }): Promise<StudentProfile> {
  if (supabase) {
    const { data, error } = await sb()
      .from("student_profiles")
      .upsert(profile)
      .select()
      .single();
    if (error) throw new ApiError(error.message);
    return data;
  }
  return {
    id: profile.id,
    full_name: profile.full_name ?? "Student",
    institution_id: profile.institution_id ?? "inst-luanar",
    programme_id: profile.programme_id ?? "prog-nas",
    current_year: profile.current_year ?? 2,
    current_semester: profile.current_semester ?? 1,
    timezone: "Africa/Blantyre",
    study_preferences: {},
  };
}

export async function getEnrolment(): Promise<Enrolment | null> {
  if (supabase) {
    return sb().from("enrolments").select("*").eq("status", "active").maybeSingle().then((r) => check(r, null));
  }
  return {
    id: "enrol-1",
    student_id: "demo-student-1",
    programme_id: "prog-nas",
    academic_period_id: "period-y2s1",
    status: "active",
  };
}

export async function upsertEnrolment(enrolment: { student_id: string; programme_id: string; academic_period_id: string }): Promise<void> {
  if (supabase) {
    const { data } = await sb()
      .from("enrolments")
      .select("id")
      .eq("student_id", enrolment.student_id)
      .eq("programme_id", enrolment.programme_id)
      .eq("academic_period_id", enrolment.academic_period_id)
      .maybeSingle();
    if (data) {
      const { error } = await sb().from("enrolments").update({ status: "active" }).eq("id", data.id);
      if (error) throw new ApiError(error.message);
    } else {
      const { error } = await sb().from("enrolments").insert({ ...enrolment, status: "active" });
      if (error) throw new ApiError(error.message);
    }
  }
}

export async function getProgrammes(): Promise<Programme[]> {
  if (supabase) {
    return sb().from("programmes").select("*").eq("is_active", true).then((r) => check(r, [] as Programme[]));
  }
  return PROGRAMMES_SEED;
}

export async function getPeriods(programmeId: string): Promise<AcademicPeriod[]> {
  if (supabase) {
    return sb()
      .from("academic_periods")
      .select("*")
      .eq("programme_id", programmeId)
      .in("status", ["active", "draft"])
      .order("academic_year", { ascending: false })
      .then((r) => check(r, [] as AcademicPeriod[]));
  }
  return [
    {
      id: "period-y2s1",
      programme_id: programmeId,
      academic_year: 2026,
      year_level: 2,
      semester: 1,
      name: "Year 2 Semester 1 (2026)",
      status: "active",
    },
  ];
}

// ---------------------------------------------------------------------------
// Curriculum (Courses, Topics, Concepts, Objectives)
// ---------------------------------------------------------------------------

export async function getCourses(programmeId: string): Promise<Course[]> {
  if (supabase) {
    const res = await sb()
      .from("courses")
      .select("*")
      .eq("programme_id", programmeId)
      .neq("status", "archived")
      .order("code");
    const courses = check(res, [] as Course[]);
    if (courses.length > 0) return courses;
  }
  return COURSES_SEED;
}

export async function getTopics(courseId: string): Promise<Topic[]> {
  if (supabase) {
    const res = await sb()
      .from("topics")
      .select("*")
      .eq("course_id", courseId)
      .neq("status", "archived")
      .order("sequence_number", { nullsFirst: false });
    const topics = check(res, [] as Topic[]);
    if (topics.length > 0) return topics;
  }
  const store = getLocalStore();
  const matched = ALL_BLUEPRINTS.filter((b) => b.topic.course_id === courseId).map((b) => b.topic);
  const custom = store.customTopics.filter((t) => t.course_id === courseId);
  return [...matched, ...custom];
}

export async function getTopicsForCourses(courseIds: string[]): Promise<Topic[]> {
  if (supabase) {
    const res = await sb()
      .from("topics")
      .select("*")
      .in("course_id", courseIds)
      .neq("status", "archived")
      .order("sequence_number", { nullsFirst: false });
    const topics = check(res, [] as Topic[]);
    if (topics.length > 0) return topics;
  }
  const store = getLocalStore();
  const matched = ALL_BLUEPRINTS.filter((b) => courseIds.includes(b.topic.course_id)).map((b) => b.topic);
  const custom = store.customTopics.filter((t) => courseIds.includes(t.course_id));
  return [...matched, ...custom];
}

export async function getTopic(topicId: string): Promise<Topic | null> {
  if (supabase) {
    const res = await sb().from("topics").select("*").eq("id", topicId).maybeSingle();
    const t = check(res, null);
    if (t) return t;
  }
  const bp = ALL_BLUEPRINTS.find((b) => b.topic.id === topicId);
  if (bp) return bp.topic;
  const store = getLocalStore();
  return store.customTopics.find((t) => t.id === topicId) ?? null;
}

export async function getSubtopics(topicId: string): Promise<Subtopic[]> {
  if (supabase) {
    return sb().from("subtopics").select("*").eq("topic_id", topicId).then((r) => check(r, [] as Subtopic[]));
  }
  return [];
}

export async function getConcepts(topicId: string): Promise<Concept[]> {
  if (supabase) {
    const res = await sb().from("concepts").select("*").eq("topic_id", topicId).neq("status", "archived");
    const items = check(res, [] as Concept[]);
    if (items.length > 0) return items;
  }
  const bp = ALL_BLUEPRINTS.find((b) => b.topic.id === topicId);
  const fromBp = bp ? bp.concepts : [];
  const store = getLocalStore();
  const custom = store.customConcepts.filter((c) => c.topic_id === topicId);
  return [...fromBp, ...custom];
}

export async function getConceptsForTopics(topicIds: string[]): Promise<Concept[]> {
  if (supabase) {
    const res = await sb().from("concepts").select("*").in("topic_id", topicIds).neq("status", "archived");
    const items = check(res, [] as Concept[]);
    if (items.length > 0) return items;
  }
  const store = getLocalStore();
  const fromBps = ALL_BLUEPRINTS.filter((b) => topicIds.includes(b.topic.id)).flatMap((b) => b.concepts);
  const custom = store.customConcepts.filter((c) => topicIds.includes(c.topic_id));
  return [...fromBps, ...custom];
}

export async function getSkills(): Promise<Skill[]> {
  if (supabase) {
    return sb().from("skills").select("*").order("name").then((r) => check(r, [] as Skill[]));
  }
  return [
    { id: "sk-1", name: "Evaluating limits", description: "Calculating algebraic, trigonometric and infinite limits", skill_type: "procedural" },
    { id: "sk-2", name: "Differentiation", description: "Computing rates of change and derivatives", skill_type: "procedural" },
    { id: "sk-3", name: "Applying Newton's laws", description: "Vector force resolution and F=ma problem solving", skill_type: "conceptual" },
    { id: "sk-4", name: "Chemical bonding & geometry", description: "Lewis structures, polarity and VSEPR theory", skill_type: "conceptual" },
    { id: "sk-5", name: "Osmosis & membrane transport", description: "Water potential equations and cellular transport", skill_type: "conceptual" },
    { id: "sk-6", name: "Gradient optimization", description: "Loss minimization and learning rate parameter updates", skill_type: "procedural" },
    { id: "sk-7", name: "Supply and demand analysis", description: "Equilibrium price solving and break-even calculations", skill_type: "conceptual" },
  ];
}

export async function getConceptPrerequisites(conceptIds: string[]): Promise<ConceptPrerequisite[]> {
  if (supabase) {
    return sb().from("concept_prerequisites").select("*").in("concept_id", conceptIds).then((r) => check(r, [] as ConceptPrerequisite[]));
  }
  return ALL_BLUEPRINTS.flatMap((b) => b.prerequisites).filter((p) => conceptIds.includes(p.concept_id));
}

export async function getObjectives(topicId: string): Promise<LearningObjective[]> {
  if (supabase) {
    const res = await sb()
      .from("learning_objectives")
      .select("*")
      .eq("topic_id", topicId)
      .neq("status", "archived")
      .order("sequence_number", { nullsFirst: false });
    const items = check(res, [] as LearningObjective[]);
    if (items.length > 0) return items;
  }
  const bp = ALL_BLUEPRINTS.find((b) => b.topic.id === topicId);
  const fromBp = bp ? bp.objectives : [];
  const store = getLocalStore();
  const custom = store.customObjectives.filter((o) => o.topic_id === topicId);
  return [...fromBp, ...custom];
}

export async function getTopicPrerequisites(topicId: string): Promise<{ from_topic_id: string; to_topic_id: string; relationship_type: string }[]> {
  if (supabase) {
    return sb()
      .from("topic_relationships")
      .select("from_topic_id, to_topic_id, relationship_type")
      .eq("relationship_type", "prerequisite")
      .or(`to_topic_id.eq.${topicId},from_topic_id.eq.${topicId}`)
      .then((r) => check(r, [] as { from_topic_id: string; to_topic_id: string; relationship_type: string }[]));
  }
  return [];
}

// ----- Curriculum Writes -----

export async function addTopic(input: {
  course_id: string;
  name: string;
  description?: string | null;
  estimated_minutes?: number | null;
  created_by: string;
  sequence_number?: number | null;
}): Promise<Topic> {
  if (supabase) {
    const { data, error } = await sb()
      .from("topics")
      .insert({ ...input, status: "student_added", source_type: "student" })
      .select()
      .single();
    if (error) throw new ApiError(error.message);
    return data;
  }
  const store = getLocalStore();
  const newTopic: Topic = {
    id: `custom-topic-${Date.now()}`,
    course_id: input.course_id,
    name: input.name,
    description: input.description ?? null,
    sequence_number: input.sequence_number ?? store.customTopics.length + 1,
    status: "student_added",
    source_type: "student",
    source_reference: null,
    estimated_minutes: input.estimated_minutes ?? 120,
    created_by: input.created_by,
    created_at: new Date().toISOString(),
  };
  store.customTopics.push(newTopic);
  saveLocalStore(store);
  return newTopic;
}

export async function addSubtopic(input: { topic_id: string; name: string; description?: string | null }): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("subtopics").insert(input);
    if (error) throw new ApiError(error.message);
  }
}

export async function addConcept(input: {
  topic_id: string;
  name: string;
  definition?: string | null;
  formula?: string | null;
  difficulty?: number | null;
  created_by: string;
}): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("concepts").insert({ ...input, status: "active", source_type: "student" });
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  store.customConcepts.push({
    id: `custom-concept-${Date.now()}`,
    topic_id: input.topic_id,
    name: input.name,
    definition: input.definition ?? null,
    formula: input.formula ?? null,
    difficulty: input.difficulty ?? 2,
    sequence_number: store.customConcepts.length + 1,
    status: "active",
    source_type: "student",
    created_by: input.created_by,
    description: null,
  });
  saveLocalStore(store);
}

export async function addConceptPrerequisite(prerequisiteId: string, conceptId: string): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("concept_prerequisites").insert({ prerequisite_id: prerequisiteId, concept_id: conceptId });
    if (error) throw new ApiError(error.message);
  }
}

export async function addObjective(input: {
  topic_id: string;
  statement: string;
  created_by: string;
  sequence_number?: number | null;
}): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("learning_objectives").insert({ ...input, status: "active", source_type: "student" });
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  store.customObjectives.push({
    id: `custom-obj-${Date.now()}`,
    course_id: null,
    topic_id: input.topic_id,
    concept_id: null,
    statement: input.statement,
    sequence_number: input.sequence_number ?? store.customObjectives.length + 1,
    status: "active",
    source_type: "student",
    created_by: input.created_by,
  });
  saveLocalStore(store);
}

export async function addTopicPrerequisite(fromTopicId: string, toTopicId: string): Promise<void> {
  if (supabase) {
    const { error } = await sb()
      .from("topic_relationships")
      .insert({ from_topic_id: fromTopicId, to_topic_id: toTopicId, relationship_type: "prerequisite" });
    if (error) throw new ApiError(error.message);
  }
}

// ---------------------------------------------------------------------------
// Content (Units, Questions, Practicals, Resources)
// ---------------------------------------------------------------------------

export async function getUnits(topicId: string): Promise<LearningUnit[]> {
  if (supabase) {
    const res = await sb()
      .from("learning_units")
      .select("*")
      .eq("topic_id", topicId)
      .neq("status", "archived")
      .order("sequence_number", { nullsFirst: false });
    const items = check(res, [] as LearningUnit[]);
    if (items.length > 0) return items;
  }
  const bp = ALL_BLUEPRINTS.find((b) => b.topic.id === topicId);
  const fromBp = bp ? bp.units : [];
  const store = getLocalStore();
  const custom = store.customUnits.filter((u) => u.topic_id === topicId);
  return [...fromBp, ...custom];
}

export async function getUnitsByIds(ids: string[]): Promise<LearningUnit[]> {
  if (!ids.length) return [];
  if (supabase) {
    return sb().from("learning_units").select("*").in("id", ids).then((r) => check(r, [] as LearningUnit[]));
  }
  const allUnits = ALL_BLUEPRINTS.flatMap((b) => b.units);
  const store = getLocalStore();
  const custom = store.customUnits;
  return [...allUnits, ...custom].filter((u) => ids.includes(u.id));
}

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  if (!ids.length) return [];
  if (supabase) {
    return sb().from("questions").select("*").in("id", ids).then((r) => check(r, [] as Question[]));
  }
  const allQ = ALL_BLUEPRINTS.flatMap((b) => b.questions);
  const store = getLocalStore();
  return [...allQ, ...store.customQuestions].filter((q) => ids.includes(q.id));
}

export async function getPracticalsByIds(ids: string[]): Promise<Practical[]> {
  if (!ids.length) return [];
  if (supabase) {
    return sb().from("practicals").select("*").in("id", ids).then((r) => check(r, [] as Practical[]));
  }
  const allP = ALL_BLUEPRINTS.flatMap((b) => b.practicals.map((p) => p.practical));
  return allP.filter((p) => ids.includes(p.id));
}

export async function addUnit(input: {
  topic_id: string;
  title: string;
  unit_type: LearningUnit["unit_type"];
  body?: string | null;
  formula?: string | null;
  description?: string | null;
  estimated_minutes?: number | null;
  difficulty?: number | null;
  created_by: string;
}): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("learning_units").insert({ ...input, status: "approved", source_type: "student" });
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  store.customUnits.push({
    id: `custom-unit-${Date.now()}`,
    topic_id: input.topic_id,
    subtopic_id: null,
    title: input.title,
    unit_type: input.unit_type,
    sequence_number: store.customUnits.length + 1,
    description: input.description ?? null,
    body: input.body ?? null,
    formula: input.formula ?? null,
    media: {},
    estimated_minutes: input.estimated_minutes ?? 15,
    difficulty: input.difficulty ?? 2,
    status: "approved",
    source_type: "student",
    source_reference: null,
    created_by: input.created_by,
  });
  saveLocalStore(store);
}

export async function getQuestions(topicId: string, opts: { includeOwnDrafts?: boolean; userId?: string } = {}): Promise<Question[]> {
  if (supabase) {
    let query = sb().from("questions").select("*").eq("topic_id", topicId);
    if (opts.includeOwnDrafts && opts.userId) {
      query = query.or(`status.eq.approved,created_by.eq.${opts.userId}`);
    }
    const res = await query.neq("status", "retired").order("difficulty");
    const questions = check(res, [] as Question[]);
    if (questions.length > 0) return questions;
  }
  const bp = ALL_BLUEPRINTS.find((b) => b.topic.id === topicId);
  const fromBp = bp ? bp.questions : [];
  const store = getLocalStore();
  const custom = store.customQuestions.filter((q) => q.topic_id === topicId);
  return [...fromBp, ...custom];
}

export async function getQuestionsForConcept(conceptId: string): Promise<Question[]> {
  if (supabase) {
    return sb()
      .from("questions")
      .select("*")
      .eq("concept_id", conceptId)
      .eq("status", "approved")
      .order("difficulty")
      .then((r) => check(r, [] as Question[]));
  }
  const allQ = ALL_BLUEPRINTS.flatMap((b) => b.questions);
  return allQ.filter((q) => q.concept_id === conceptId);
}

export async function getQuestionOptions(questionIds: string[]): Promise<QuestionOption[]> {
  if (!questionIds.length) return [];
  if (supabase) {
    const res = await sb().from("question_options").select("*").in("question_id", questionIds).order("sequence_number");
    const options = check(res, [] as QuestionOption[]);
    if (options.length > 0) return options;
  }
  const allOpts = ALL_BLUEPRINTS.flatMap((b) => b.options);
  const store = getLocalStore();
  return [...allOpts, ...store.customOptions].filter((o) => questionIds.includes(o.question_id));
}

export async function addQuestion(input: {
  topic_id: string;
  question_type: Question["question_type"];
  difficulty: number;
  question_text: string;
  correct_answer: unknown;
  explanation?: string | null;
  hint_1?: string | null;
  hint_2?: string | null;
  is_diagnostic?: boolean;
  scaffolding?: Record<string, unknown>;
  concept_id?: string | null;
  skill_id?: string | null;
  learning_objective_id?: string | null;
  created_by: string;
  options?: { option_key: string; option_text: string }[];
}): Promise<Question> {
  if (supabase) {
    const { data, error } = await sb()
      .from("questions")
      .insert({ ...input, status: "approved", source_type: "student" })
      .select()
      .single();
    if (error) throw new ApiError(error.message);
    if (input.options?.length) {
      const { error: optError } = await sb()
        .from("question_options")
        .insert(input.options.map((o, i) => ({ question_id: data.id, ...o, sequence_number: i + 1 })));
      if (optError) throw new ApiError(optError.message);
    }
    return data;
  }
  const store = getLocalStore();
  const newQ: Question = {
    id: `custom-q-${Date.now()}`,
    topic_id: input.topic_id,
    subtopic_id: null,
    question_type: input.question_type,
    difficulty: input.difficulty,
    question_text: input.question_text,
    correct_answer: input.correct_answer,
    explanation: input.explanation ?? null,
    hint_1: input.hint_1 ?? null,
    hint_2: input.hint_2 ?? null,
    is_diagnostic: input.is_diagnostic ?? false,
    scaffolding: input.scaffolding ?? {},
    status: "approved",
    concept_id: input.concept_id ?? null,
    skill_id: input.skill_id ?? null,
    learning_objective_id: input.learning_objective_id ?? null,
    created_by: input.created_by,
  };
  store.customQuestions.push(newQ);
  if (input.options?.length) {
    input.options.forEach((opt, i) => {
      store.customOptions.push({
        id: `custom-opt-${Date.now()}-${i}`,
        question_id: newQ.id,
        option_key: opt.option_key,
        option_text: opt.option_text,
        sequence_number: i + 1,
      });
    });
  }
  saveLocalStore(store);
  return newQ;
}

export async function getPracticals(topicId: string): Promise<Practical[]> {
  if (supabase) {
    const res = await sb().from("practicals").select("*").eq("topic_id", topicId).neq("status", "archived");
    const items = check(res, [] as Practical[]);
    if (items.length > 0) return items;
  }
  const bp = ALL_BLUEPRINTS.find((b) => b.topic.id === topicId);
  return bp ? bp.practicals.map((p) => p.practical) : [];
}

export async function getPracticalSteps(practicalIds: string[]): Promise<PracticalStep[]> {
  if (!practicalIds.length) return [];
  if (supabase) {
    const res = await sb().from("practical_steps").select("*").in("practical_id", practicalIds).order("step_number");
    const steps = check(res, [] as PracticalStep[]);
    if (steps.length > 0) return steps;
  }
  const allSteps = ALL_BLUEPRINTS.flatMap((b) => b.practicals.flatMap((p) => p.steps));
  return allSteps.filter((s) => practicalIds.includes(s.practical_id));
}

export async function getResourcesForTopics(topicIds: string[]): Promise<{ resources: Resource[]; links: { topic_id: string; resource_id: string; sequence_number: number | null }[] }> {
  if (!topicIds.length) return { resources: [], links: [] };
  if (supabase) {
    const [linksRes, resRes] = await Promise.all([
      sb().from("topic_resources").select("topic_id, resource_id, sequence_number").in("topic_id", topicIds),
      sb().from("content_resources").select("*").neq("status", "archived"),
    ]);
    const links = check(linksRes, [] as { topic_id: string; resource_id: string; sequence_number: number | null }[]);
    const resources = check(resRes, [] as Resource[]);
    if (resources.length > 0) {
      const ids = new Set(links.map((l) => l.resource_id));
      return { links, resources: resources.filter((r) => ids.has(r.id)) };
    }
  }
  const matchedBlueprints = ALL_BLUEPRINTS.filter((b) => topicIds.includes(b.topic.id));
  const resources = matchedBlueprints.flatMap((b) => b.resources);
  const links = matchedBlueprints.flatMap((b) => b.topicResources);
  return { resources, links };
}

export async function addResource(input: {
  title: string;
  description?: string | null;
  resource_type: Resource["resource_type"];
  url?: string | null;
  provider?: string | null;
  author?: string | null;
  duration_seconds?: number | null;
  difficulty?: number | null;
  source_level: 1 | 2 | 3 | 4;
  provenance?: Record<string, unknown>;
  topic_ids?: string[];
}): Promise<void> {
  if (supabase) {
    const { data, error } = await sb().from("content_resources").insert({ ...input, status: "active" }).select().single();
    if (error) throw new ApiError(error.message);
    if (input.topic_ids?.length) {
      const { error: linkError } = await sb()
        .from("topic_resources")
        .insert(input.topic_ids.map((topic_id) => ({ topic_id, resource_id: data.id })));
      if (linkError) throw new ApiError(linkError.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Learning sessions
// ---------------------------------------------------------------------------

export async function getActiveSession(topicId: string): Promise<LearningSession | null> {
  if (supabase) {
    return sb()
      .from("learning_sessions")
      .select("*")
      .eq("topic_id", topicId)
      .in("status", ["active", "paused"])
      .maybeSingle()
      .then((r) => check(r, null));
  }
  const store = getLocalStore();
  return store.sessions.find((s) => s.topic_id === topicId && (s.status === "active" || s.status === "paused")) ?? null;
}

export async function getActiveSessions(): Promise<LearningSession[]> {
  if (supabase) {
    return sb()
      .from("learning_sessions")
      .select("*")
      .in("status", ["active", "paused"])
      .order("updated_at", { ascending: false })
      .then((r) => check(r, [] as LearningSession[]));
  }
  const store = getLocalStore();
  return store.sessions.filter((s) => s.status === "active" || s.status === "paused");
}

export async function getSession(sessionId: string): Promise<LearningSession | null> {
  if (supabase) {
    return sb().from("learning_sessions").select("*").eq("id", sessionId).maybeSingle().then((r) => check(r, null));
  }
  const store = getLocalStore();
  return store.sessions.find((s) => s.id === sessionId) ?? null;
}

export async function getSessionSteps(sessionId: string): Promise<SessionStep[]> {
  if (supabase) {
    return sb()
      .from("learning_session_steps")
      .select("*")
      .eq("learning_session_id", sessionId)
      .order("step_number")
      .then((r) => check(r, [] as SessionStep[]));
  }
  const store = getLocalStore();
  return store.sessionSteps.filter((s) => s.learning_session_id === sessionId).sort((a, b) => a.step_number - b.step_number);
}

export async function createSessionWithSteps(
  session: Omit<LearningSession, "id">,
  steps: Omit<SessionStep, "id" | "learning_session_id">[],
): Promise<LearningSession> {
  if (supabase) {
    const { data: sessionData, error } = await sb().from("learning_sessions").insert(session).select().single();
    if (error) throw new ApiError(error.message);
    const rows = steps.map((s, i) => ({ ...s, learning_session_id: sessionData.id, status: i === 0 ? "unlocked" : "locked" }));
    const { error: stepsError } = await sb().from("learning_session_steps").insert(rows);
    if (stepsError) throw new ApiError(stepsError.message);
    return sessionData;
  }
  const store = getLocalStore();
  const sessionData: LearningSession = {
    ...session,
    id: `sess-${Date.now()}`,
  };
  store.sessions.push(sessionData);
  const createdSteps: SessionStep[] = steps.map((s, i) => ({
    ...s,
    id: `step-${sessionData.id}-${i + 1}`,
    learning_session_id: sessionData.id,
    status: i === 0 ? "unlocked" : "locked",
  }));
  store.sessionSteps.push(...createdSteps);
  saveLocalStore(store);
  return sessionData;
}

export async function updateStep(
  stepId: string,
  patch: Partial<Pick<SessionStep, "status" | "score" | "completed_at" | "duration_seconds" | "metadata">>,
): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("learning_session_steps").update(patch).eq("id", stepId);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  const idx = store.sessionSteps.findIndex((s) => s.id === stepId);
  if (idx >= 0) {
    store.sessionSteps[idx] = { ...store.sessionSteps[idx], ...patch };
    saveLocalStore(store);
  }
}

export async function markStepsSkipped(stepIds: string[]): Promise<void> {
  if (!stepIds.length) return;
  if (supabase) {
    const { error } = await sb().from("learning_session_steps").update({ status: "skipped" }).in("id", stepIds);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  store.sessionSteps = store.sessionSteps.map((s) => (stepIds.includes(s.id) ? { ...s, status: "skipped" } : s));
  saveLocalStore(store);
}

export async function setSessionProgress(
  sessionId: string,
  patch: Partial<Pick<LearningSession, "current_step" | "status" | "diagnostic_score" | "difficulty_floor" | "settings" | "completed_at">>,
): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("learning_sessions").update(patch).eq("id", sessionId);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  const idx = store.sessions.findIndex((s) => s.id === sessionId);
  if (idx >= 0) {
    store.sessions[idx] = { ...store.sessions[idx], ...patch };
    saveLocalStore(store);
  }
}

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

export async function recordQuestionAttempt(input: {
  student_id: string;
  question_id: string;
  learning_session_id?: string | null;
  study_session_id?: string | null;
  answer: unknown;
  is_correct: boolean | null;
  score: number | null;
  time_seconds?: number | null;
  hints_used: number;
  attempt_number: number;
}): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("question_attempts").insert(input);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  store.questionAttempts.push({
    student_id: input.student_id,
    question_id: input.question_id,
    learning_session_id: input.learning_session_id ?? null,
    answer: input.answer,
    is_correct: input.is_correct,
    score: input.score,
    hints_used: input.hints_used,
    attempted_at: new Date().toISOString(),
  });
  saveLocalStore(store);
}

export async function countAttempts(questionId: string, sessionId: string | null): Promise<number> {
  if (supabase) {
    return sb()
      .from("question_attempts")
      .select("id", { count: "exact", head: true })
      .eq("question_id", questionId)
      .eq("learning_session_id", sessionId)
      .then((r) => (r.error ? 0 : (r.data as unknown as number) ?? 0));
  }
  const store = getLocalStore();
  return store.questionAttempts.filter((a) => a.question_id === questionId && a.learning_session_id === sessionId).length;
}

export async function getAttemptsForQuestions(questionIds: string[]): Promise<{
  student_id: string;
  question_id: string;
  learning_session_id: string | null;
  answer: unknown;
  is_correct: boolean | null;
  score: number | null;
  hints_used: number;
  attempted_at: string;
}[]> {
  if (!questionIds.length) return [];
  if (supabase) {
    return sb()
      .from("question_attempts")
      .select("student_id, question_id, learning_session_id, answer, is_correct, score, hints_used, attempted_at")
      .in("question_id", questionIds)
      .order("attempted_at", { ascending: false })
      .then((r) => check(r, [] as any[]));
  }
  const store = getLocalStore();
  return store.questionAttempts.filter((a) => questionIds.includes(a.question_id));
}

// ---------------------------------------------------------------------------
// Mastery & Review
// ---------------------------------------------------------------------------

export async function getTopicMastery(): Promise<TopicMastery[]> {
  if (supabase) {
    const res = await sb().from("topic_mastery").select("*");
    const data = check(res, [] as TopicMastery[]);
    if (data.length > 0) return data;
  }
  const store = getLocalStore();
  return store.topicMastery;
}

export async function upsertTopicMastery(input: {
  student_id: string;
  topic_id: string;
  mastery_score: number;
  mastery_level: string;
  confidence_score: number;
  attempt_count: number;
  last_practiced_at?: string | null;
  last_assessed_at?: string | null;
  next_review_at?: string | null;
}): Promise<void> {
  if (supabase) {
    const { error } = await sb()
      .from("topic_mastery")
      .upsert(input, { onConflict: "student_id,topic_id" });
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  const idx = store.topicMastery.findIndex((m) => m.topic_id === input.topic_id);
  const row: TopicMastery = {
    id: idx >= 0 ? store.topicMastery[idx].id : `tm-${Date.now()}`,
    student_id: input.student_id,
    topic_id: input.topic_id,
    mastery_score: input.mastery_score,
    mastery_level: input.mastery_level,
    confidence_score: input.confidence_score,
    attempt_count: input.attempt_count,
    last_practiced_at: input.last_practiced_at ?? null,
    last_assessed_at: input.last_assessed_at ?? null,
    next_review_at: input.next_review_at ?? null,
  };
  if (idx >= 0) store.topicMastery[idx] = row;
  else store.topicMastery.push(row);
  saveLocalStore(store);
}

export async function getConceptMastery(): Promise<ConceptMastery[]> {
  if (supabase) {
    const res = await sb().from("concept_mastery").select("*");
    const data = check(res, [] as ConceptMastery[]);
    if (data.length > 0) return data;
  }
  const store = getLocalStore();
  return store.conceptMastery;
}

export async function upsertConceptMastery(input: {
  student_id: string;
  concept_id: string;
  mastery_score: number;
  mastery_level: string;
  confidence_score: number;
  attempt_count: number;
  last_assessed_at?: string | null;
}): Promise<void> {
  if (supabase) {
    const { error } = await sb()
      .from("concept_mastery")
      .upsert(input, { onConflict: "student_id,concept_id" });
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  const idx = store.conceptMastery.findIndex((m) => m.concept_id === input.concept_id);
  const row: ConceptMastery = {
    id: idx >= 0 ? store.conceptMastery[idx].id : `cm-${Date.now()}`,
    student_id: input.student_id,
    concept_id: input.concept_id,
    mastery_score: input.mastery_score,
    mastery_level: input.mastery_level as any,
    confidence_score: input.confidence_score,
    attempt_count: input.attempt_count,
    last_assessed_at: input.last_assessed_at ?? null,
  };
  if (idx >= 0) store.conceptMastery[idx] = row;
  else store.conceptMastery.push(row);
  saveLocalStore(store);
}

export async function getReviews(): Promise<ReviewItem[]> {
  if (supabase) {
    return sb()
      .from("review_schedule")
      .select("*")
      .eq("status", "scheduled")
      .order("scheduled_for")
      .then((r) => check(r, [] as ReviewItem[]));
  }
  const store = getLocalStore();
  return store.reviews.filter((r) => r.status === "scheduled");
}

export async function upsertReview(input: {
  student_id: string;
  topic_id: string;
  scheduled_for: string;
  interval_days: number;
  ease_factor: number;
}): Promise<void> {
  if (supabase) {
    const { data } = await sb()
      .from("review_schedule")
      .select("id")
      .eq("student_id", input.student_id)
      .eq("topic_id", input.topic_id)
      .eq("status", "scheduled")
      .maybeSingle();
    if (data) {
      const { error } = await sb()
        .from("review_schedule")
        .update({ scheduled_for: input.scheduled_for, interval_days: input.interval_days, ease_factor: input.ease_factor })
        .eq("id", data.id);
      if (error) throw new ApiError(error.message);
    } else {
      const { error } = await sb().from("review_schedule").insert(input);
      if (error) throw new ApiError(error.message);
    }
    return;
  }
  const store = getLocalStore();
  const idx = store.reviews.findIndex((r) => r.topic_id === input.topic_id && r.status === "scheduled");
  const row: ReviewItem = {
    id: idx >= 0 ? store.reviews[idx].id : `rev-${Date.now()}`,
    student_id: input.student_id,
    topic_id: input.topic_id,
    scheduled_for: input.scheduled_for,
    interval_days: input.interval_days,
    ease_factor: input.ease_factor,
    status: "scheduled",
  };
  if (idx >= 0) store.reviews[idx] = row;
  else store.reviews.push(row);
  saveLocalStore(store);
}

export async function completeReview(reviewId: string): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("review_schedule").update({ status: "completed" }).eq("id", reviewId);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  const idx = store.reviews.findIndex((r) => r.id === reviewId);
  if (idx >= 0) {
    store.reviews[idx].status = "completed";
    saveLocalStore(store);
  }
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export async function getActiveRecommendations(): Promise<Recommendation[]> {
  if (supabase) {
    return sb()
      .from("recommendations")
      .select("*")
      .eq("status", "active")
      .order("priority", { ascending: false })
      .then((r) => check(r, [] as Recommendation[]));
  }
  const store = getLocalStore();
  return store.recommendations.filter((r) => r.status === "active");
}

export async function insertRecommendation(input: {
  student_id: string;
  course_id: string | null;
  topic_id: string | null;
  recommendation_type: string;
  priority: number;
  reason: string;
}): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("recommendations").insert(input);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  store.recommendations.push({
    id: `rec-${Date.now()}`,
    student_id: input.student_id,
    course_id: input.course_id,
    topic_id: input.topic_id,
    recommendation_type: input.recommendation_type,
    priority: input.priority,
    reason: input.reason,
    status: "active",
    created_at: new Date().toISOString(),
  });
  saveLocalStore(store);
}

export async function setRecommendationStatus(id: string, status: Recommendation["status"]): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("recommendations").update({ status }).eq("id", id);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  const idx = store.recommendations.findIndex((r) => r.id === id);
  if (idx >= 0) {
    store.recommendations[idx].status = status;
    saveLocalStore(store);
  }
}

// ---------------------------------------------------------------------------
// Materials & Extraction
// ---------------------------------------------------------------------------

export async function uploadMaterial(input: {
  file: File;
  student_id: string;
  course_id?: string | null;
  topic_id?: string | null;
}): Promise<UploadedMaterial> {
  if (supabase) {
    const path = `${input.student_id}/${Date.now()}-${input.file.name.replace(/[^\w.\-]+/g, "_")}`;
    const { error } = await sb().storage.from("student-materials").upload(path, input.file, { upsert: false });
    if (error) throw new ApiError(`Upload failed: ${error.message}`);
    const { data, error: rowError } = await sb()
      .from("uploaded_materials")
      .insert({
        student_id: input.student_id,
        course_id: input.course_id ?? null,
        topic_id: input.topic_id ?? null,
        file_name: input.file.name,
        storage_path: path,
        mime_type: input.file.type || null,
        file_size: input.file.size,
        processing_status: "ready",
      })
      .select()
      .single();
    if (rowError) throw new ApiError(rowError.message);
    return data;
  }
  const store = getLocalStore();
  const mat: UploadedMaterial = {
    id: `mat-${Date.now()}`,
    student_id: input.student_id,
    course_id: input.course_id ?? null,
    topic_id: input.topic_id ?? null,
    file_name: input.file.name,
    storage_path: `local/${input.file.name}`,
    mime_type: input.file.type || "text/plain",
    file_size: input.file.size,
    processing_status: "ready",
    processing_error: null,
    extracted_text: "Extracted course notes and key definitions.",
    page_count: 1,
    ai_classification: { document_type: "Lecture Note" },
    created_at: new Date().toISOString(),
  };
  store.uploadedMaterials.unshift(mat);
  saveLocalStore(store);
  return mat;
}

export async function getMaterials(): Promise<UploadedMaterial[]> {
  if (supabase) {
    return sb().from("uploaded_materials").select("*").order("created_at", { ascending: false }).then((r) => check(r, [] as UploadedMaterial[]));
  }
  const store = getLocalStore();
  return store.uploadedMaterials;
}

export async function getExtractedItems(materialId: string): Promise<ExtractedItem[]> {
  if (supabase) {
    return sb()
      .from("extracted_content")
      .select("*")
      .eq("material_id", materialId)
      .order("source_page", { nullsFirst: true })
      .then((r) => check(r, [] as ExtractedItem[]));
  }
  return [
    {
      id: `ext-1-${materialId}`,
      material_id: materialId,
      item_type: "definition",
      content: "A limit is the target value a function approaches as input approaches a specified number.",
      heading: "Foundations of Calculus",
      source_page: 1,
      confidence: 0.95,
      concept_id: "c-lim-1",
      question_id: null,
    },
  ];
}

export async function deleteMaterial(materialId: string): Promise<void> {
  if (supabase) {
    const { data, error } = await sb().from("uploaded_materials").select("storage_path").eq("id", materialId).single();
    if (error) throw new ApiError(error.message);
    await sb().storage.from("student-materials").remove([data.storage_path]);
    const { error: delError } = await sb().from("uploaded_materials").delete().eq("id", materialId);
    if (delError) throw new ApiError(delError.message);
    return;
  }
  const store = getLocalStore();
  store.uploadedMaterials = store.uploadedMaterials.filter((m) => m.id !== materialId);
  saveLocalStore(store);
}

// ---------------------------------------------------------------------------
// AI Tutor & Feynman Evaluation
// ---------------------------------------------------------------------------

export interface AiContextPayload {
  programme: string | null;
  year: number | null;
  semester: number | null;
  course: string | null;
  topic: string | null;
  concept: string | null;
  session: { title: string | null; current_step: number; completed: number; total: number } | null;
  mastery: { topic: string; level: string; score: number }[];
  weak_concepts: string[];
  recent_attempts: { question: string; correct: boolean | null; hints_used: number; when: string }[];
  sources: { level: 1 | 2 | 3 | 4; title: string; excerpt: string | null }[];
  task:
    | "tutor"
    | "explain"
    | "explain_simply"
    | "analogy"
    | "example"
    | "math_reasoning"
    | "practical_example"
    | "quiz"
    | "hint"
    | "why_wrong"
    | "teach_from_beginning"
    | "test_understanding"
    | "feynman_evaluate";
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface AiReply {
  content: string;
  source_level: 1 | 2 | 3 | 4;
  needs_more_info: boolean;
  missing_info?: string;
}

export async function invokeAiTutor(payload: AiContextPayload & { conversation_id: string }): Promise<AiReply> {
  if (supabase) {
    const { data, error } = await sb().functions.invoke("ai-tutor", { body: payload });
    if (error) throw new ApiError(error.message ?? "AI service unavailable", "ai_unavailable");
    if (data && typeof data === "object" && (data as { error_code?: string }).error_code === "ai_not_configured") {
      throw new ApiError("The AI provider is not configured for this deployment.", "ai_not_configured");
    }
    return data as AiReply;
  }

  // Deterministic local AI reasoning response grounded in course blueprint
  return generateDeterministicAiResponse(payload);
}

function generateDeterministicAiResponse(payload: AiContextPayload): AiReply {
  const topic = payload.topic ?? "Calculus";
  const task = payload.task;

  switch (task) {
    case "explain_simply":
      return {
        content: `Think of a limit like zooming in on a GPS map as you drive toward a bridge. You don't need to actually cross the bridge to know exactly where the road is leading. In ${topic}, a limit describes the destination value a function approaches as your x-input gets closer and closer to a target number.`,
        source_level: 2,
        needs_more_info: false,
      };
    case "analogy":
      return {
        content: `Analogy for ${topic}: Imagine walking toward a door. Each step cuts the remaining distance in half (1m, 0.5m, 0.25m...). You get infinitely close to the doorway without mathematically needing to stand on the exact physical threshold line. That destination point is the limit!`,
        source_level: 2,
        needs_more_info: false,
      };
    case "math_reasoning":
      return {
        content: `Mathematical Reasoning: When direct substitution yields 0/0 (indeterminate form), factor the polynomials: f(x) = (x-c)g(x) / [(x-c)h(x)]. Because x -> c implies x != c, the factor (x-c) cancels out completely, leaving lim_{x->c} g(x)/h(x) = g(c)/h(c).`,
        source_level: 2,
        needs_more_info: false,
      };
    case "why_wrong":
      return {
        content: `Most errors in ${topic} occur because students evaluate f(c) directly instead of analyzing the approaching behavior from both left (x -> c-) and right (x -> c+). Always verify whether one-sided limits match before concluding the two-sided limit exists.`,
        source_level: 2,
        needs_more_info: false,
      };
    case "feynman_evaluate":
      return {
        content: `Evaluation: 88 / 100.\nConceptual Correctness: High. You clearly articulated the difference between point evaluation and dynamic approach.\nClarity: Excellent use of physical intuition.\nRecommendation: To achieve 100%, explicitly state the 3 formal conditions for continuity (f(c) defined, limit exists, limit equals f(c)).`,
        source_level: 2,
        needs_more_info: false,
      };
    default:
      return {
        content: `In ${topic}, focus on the sequence of operations: (1) Check direct substitution, (2) If 0/0, factor or multiply by the algebraic conjugate, (3) Verify one-sided limits match. What step would you like to work through together?`,
        source_level: 2,
        needs_more_info: false,
      };
  }
}

export async function createConversation(input: {
  student_id: string;
  course_id?: string | null;
  topic_id?: string | null;
  mode?: AiConversation["mode"];
  title?: string | null;
}): Promise<AiConversation> {
  if (supabase) {
    const { data, error } = await sb().from("ai_conversations").insert(input).select().single();
    if (error) throw new ApiError(error.message);
    return data;
  }
  const store = getLocalStore();
  const conv: AiConversation = {
    id: `conv-${Date.now()}`,
    student_id: input.student_id,
    course_id: input.course_id ?? null,
    topic_id: input.topic_id ?? null,
    mode: input.mode ?? "tutor",
    title: input.title ?? "AI Tutor",
    created_at: new Date().toISOString(),
  };
  store.conversations.push(conv);
  saveLocalStore(store);
  return conv;
}

export async function getConversationMessages(conversationId: string): Promise<AiMessage[]> {
  if (supabase) {
    return sb()
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .then((r) => check(r, [] as AiMessage[]));
  }
  const store = getLocalStore();
  return store.messages.filter((m) => m.conversation_id === conversationId);
}

export async function addMessage(input: {
  conversation_id: string;
  role: AiMessage["role"];
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("ai_messages").insert(input);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  store.messages.push({
    id: `msg-${Date.now()}`,
    conversation_id: input.conversation_id,
    role: input.role,
    content: input.content,
    metadata: input.metadata ?? {},
    created_at: new Date().toISOString(),
  });
  saveLocalStore(store);
}

export async function addExplainBackAttempt(input: {
  student_id: string;
  topic_id: string | null;
  concept_id: string | null;
  prompt: string;
  student_response: string;
  ai_feedback?: Record<string, unknown> | null;
  score?: number | null;
}): Promise<ExplainBackAttempt> {
  if (supabase) {
    const { data, error } = await sb().from("explain_back_attempts").insert(input).select().single();
    if (error) throw new ApiError(error.message);
    return data;
  }
  const store = getLocalStore();
  const attempt: ExplainBackAttempt = {
    id: `exp-${Date.now()}`,
    student_id: input.student_id,
    topic_id: input.topic_id,
    concept_id: input.concept_id,
    prompt: input.prompt,
    student_response: input.student_response,
    ai_feedback: input.ai_feedback ?? null,
    score: input.score ?? null,
    created_at: new Date().toISOString(),
  };
  store.explainBackAttempts.push(attempt);
  saveLocalStore(store);
  return attempt;
}

export async function updateExplainBackAttempt(
  id: string,
  patch: { ai_feedback?: Record<string, unknown> | null; score?: number | null },
): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("explain_back_attempts").update(patch).eq("id", id);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  const idx = store.explainBackAttempts.findIndex((a) => a.id === id);
  if (idx >= 0) {
    store.explainBackAttempts[idx] = { ...store.explainBackAttempts[idx], ...patch };
    saveLocalStore(store);
  }
}

// ---------------------------------------------------------------------------
// Assessments (Phase 5)
// ---------------------------------------------------------------------------

export async function getAssessments(courseId: string): Promise<Assessment[]> {
  if (supabase) {
    const res = await sb()
      .from("assessments")
      .select("*")
      .eq("course_id", courseId)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    const data = check(res, [] as Assessment[]);
    if (data.length > 0) return data;
  }
  const store = getLocalStore();
  return store.assessments.filter((a) => a.course_id === courseId);
}

export async function getAssessment(id: string): Promise<Assessment | null> {
  if (supabase) {
    return sb().from("assessments").select("*").eq("id", id).maybeSingle().then((r) => check(r, null));
  }
  const store = getLocalStore();
  return store.assessments.find((a) => a.id === id) ?? null;
}

export async function createAssessment(input: {
  course_id: string;
  topic_id?: string | null;
  title: string;
  description?: string | null;
  question_ids: string[];
  pass_percent?: number;
  time_limit_seconds?: number | null;
  status?: "draft" | "review";
  source_type?: string | null;
  created_by?: string | null;
}): Promise<Assessment> {
  if (supabase) {
    const { data, error } = await sb().from("assessments").insert({
      ...input,
      topic_id: input.topic_id ?? null,
      pass_percent: input.pass_percent ?? 70,
      time_limit_seconds: input.time_limit_seconds ?? null,
      status: input.status ?? "draft",
    }).select().single();
    if (error) throw new ApiError(error.message);
    return data;
  }
  const store = getLocalStore();
  const asmt: Assessment = {
    id: `asmt-${Date.now()}`,
    course_id: input.course_id,
    topic_id: input.topic_id ?? null,
    title: input.title,
    description: input.description ?? null,
    question_ids: input.question_ids,
    pass_percent: input.pass_percent ?? 75,
    time_limit_seconds: input.time_limit_seconds ?? 1800,
    status: (input.status as any) ?? "approved",
    source_type: input.source_type ?? "curriculum",
    created_by: input.created_by ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  store.assessments.push(asmt);
  saveLocalStore(store);
  return asmt;
}

export async function updateAssessment(
  id: string,
  patch: Partial<Pick<Assessment, "title" | "description" | "question_ids" | "pass_percent" | "time_limit_seconds" | "status">>,
): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("assessments").update(patch).eq("id", id);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  const idx = store.assessments.findIndex((a) => a.id === id);
  if (idx >= 0) {
    store.assessments[idx] = { ...store.assessments[idx], ...patch };
    saveLocalStore(store);
  }
}

export async function deleteAssessment(id: string): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("assessments").delete().eq("id", id);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  store.assessments = store.assessments.filter((a) => a.id !== id);
  saveLocalStore(store);
}

export async function startAssessmentAttempt(input: {
  student_id: string;
  assessment_id: string;
  learning_session_id?: string | null;
}): Promise<AssessmentAttempt> {
  if (supabase) {
    const { data, error } = await sb()
      .from("assessment_attempts")
      .insert({ ...input, learning_session_id: input.learning_session_id ?? null })
      .select()
      .single();
    if (error) throw new ApiError(error.message);
    return data;
  }
  const store = getLocalStore();
  const att: AssessmentAttempt = {
    id: `asmt-att-${Date.now()}`,
    student_id: input.student_id,
    assessment_id: input.assessment_id,
    learning_session_id: input.learning_session_id ?? null,
    started_at: new Date().toISOString(),
    submitted_at: null,
    score: null,
    passed: null,
    question_results: [],
    created_at: new Date().toISOString(),
  };
  store.assessmentAttempts.unshift(att);
  saveLocalStore(store);
  return att;
}

export async function requestMaterialProcessing(materialId: string): Promise<{ ok: boolean; message: string }> {
  if (supabase) {
    const { data, error } = await sb().functions.invoke("process-material", { body: { material_id: materialId } });
    if (error) {
      return { ok: false, message: error.message ?? "Edge Function unavailable" };
    }
    const body = data as { ok?: boolean; message?: string } | null;
    return { ok: body?.ok ?? false, message: body?.message ?? "" };
  }
  return { ok: true, message: "Material extracted." };
}
export async function submitAssessmentAttempt(
  id: string,
  patch: {
    submitted_at: string;
    score: number;
    passed: boolean;
    question_results: QuestionResult[];
  },
): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("assessment_attempts").update(patch).eq("id", id);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  const idx = store.assessmentAttempts.findIndex((a) => a.id === id);
  if (idx >= 0) {
    store.assessmentAttempts[idx] = { ...store.assessmentAttempts[idx], ...patch };
    saveLocalStore(store);
  }
}

export async function getMyAssessmentAttempts(assessmentId?: string): Promise<AssessmentAttempt[]> {
  if (supabase) {
    let q = sb().from("assessment_attempts").select("*").order("created_at", { ascending: false });
    if (assessmentId) q = q.eq("assessment_id", assessmentId);
    return q.then((r) => check(r, [] as AssessmentAttempt[]));
  }
  const store = getLocalStore();
  if (assessmentId) return store.assessmentAttempts.filter((a) => a.assessment_id === assessmentId);
  return store.assessmentAttempts;
}

// ---------------------------------------------------------------------------
// Practical Activities (Phase 9)
// ---------------------------------------------------------------------------

export async function recordActivityAttempt(input: {
  student_id: string;
  activity_type: string;
  subject?: string | null;
  scenario: Record<string, unknown>;
  answer: Record<string, unknown>;
  is_correct: boolean | null;
  score: number | null;
  time_seconds?: number | null;
}): Promise<void> {
  if (supabase) {
    const { error } = await sb().from("activity_attempts").insert(input);
    if (error) throw new ApiError(error.message);
    return;
  }
  const store = getLocalStore();
  store.activityAttempts.unshift({
    id: `act-att-${Date.now()}`,
    student_id: input.student_id,
    activity_type: input.activity_type,
    subject: input.subject ?? null,
    scenario: input.scenario,
    answer: input.answer,
    is_correct: input.is_correct,
    score: input.score,
    time_seconds: input.time_seconds ?? null,
    created_at: new Date().toISOString(),
  });
  saveLocalStore(store);
}

export async function getMyActivityAttempts(limit = 20): Promise<ActivityAttempt[]> {
  if (supabase) {
    return sb()
      .from("activity_attempts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)
      .then((r) => check(r, [] as ActivityAttempt[]));
  }
  const store = getLocalStore();
  return store.activityAttempts.slice(0, limit);
}
