// Data access layer — every query/mutation the UI performs goes through here.
// Pure engines (session/mastery/answer/recommendations) are imported by pages,
// not by this module, so they stay independently testable.

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
  UploadedMaterial,} from "../types";

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
// Profile & onboarding
// ---------------------------------------------------------------------------

export function getProfile(): PromiseLike<StudentProfile | null> {
  return sb()
    .from("student_profiles")
    .select("*")
    .maybeSingle()
    .then((r) => check(r, null));
}

export async function upsertProfile(profile: Partial<StudentProfile> & { id: string }): Promise<StudentProfile> {
  const { data, error } = await sb()
    .from("student_profiles")
    .upsert(profile)
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data;
}

export function getEnrolment(): PromiseLike<Enrolment | null> {
  return sb().from("enrolments").select("*").eq("status", "active").maybeSingle().then((r) => check(r, null));
}

export async function upsertEnrolment(enrolment: { student_id: string; programme_id: string; academic_period_id: string }): Promise<void> {
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

export function getProgrammes(): PromiseLike<Programme[]> {
  return sb().from("programmes").select("*").eq("is_active", true).then((r) => check(r, [] as Programme[]));
}

export function getPeriods(programmeId: string): PromiseLike<AcademicPeriod[]> {
  return sb()
    .from("academic_periods")
    .select("*")
    .eq("programme_id", programmeId)
    .in("status", ["active", "draft"])
    .order("academic_year", { ascending: false })
    .then((r) => check(r, [] as AcademicPeriod[]));
}

// ---------------------------------------------------------------------------
// Curriculum
// ---------------------------------------------------------------------------

export function getCourses(programmeId: string): PromiseLike<Course[]> {
  return sb()
    .from("courses")
    .select("*")
    .eq("programme_id", programmeId)
    .neq("status", "archived")
    .order("code")
    .then((r) => check(r, [] as Course[]));
}

export function getTopics(courseId: string): PromiseLike<Topic[]> {
  return sb()
    .from("topics")
    .select("*")
    .eq("course_id", courseId)
    .neq("status", "archived")
    .order("sequence_number", { nullsFirst: false })
    .then((r) => check(r, [] as Topic[]));
}

export function getTopicsForCourses(courseIds: string[]): PromiseLike<Topic[]> {
  return sb()
    .from("topics")
    .select("*")
    .in("course_id", courseIds)
    .neq("status", "archived")
    .order("sequence_number", { nullsFirst: false })
    .then((r) => check(r, [] as Topic[]));
}

export function getTopic(topicId: string): PromiseLike<Topic | null> {
  return sb().from("topics").select("*").eq("id", topicId).maybeSingle().then((r) => check(r, null));
}

export function getSubtopics(topicId: string): PromiseLike<Subtopic[]> {
  return sb().from("subtopics").select("*").eq("topic_id", topicId).then((r) => check(r, [] as Subtopic[]));
}

export function getConcepts(topicId: string): PromiseLike<Concept[]> {
  return sb().from("concepts").select("*").eq("topic_id", topicId).neq("status", "archived").then((r) => check(r, [] as Concept[]));
}

export function getConceptsForTopics(topicIds: string[]): PromiseLike<Concept[]> {
  return sb().from("concepts").select("*").in("topic_id", topicIds).neq("status", "archived").then((r) => check(r, [] as Concept[]));
}

export function getSkills(): PromiseLike<Skill[]> {
  return sb().from("skills").select("*").order("name").then((r) => check(r, [] as Skill[]));
}

export function getConceptPrerequisites(conceptIds: string[]): PromiseLike<ConceptPrerequisite[]> {
  return sb().from("concept_prerequisites").select("*").in("concept_id", conceptIds).then((r) => check(r, [] as ConceptPrerequisite[]));
}

export function getObjectives(topicId: string): PromiseLike<LearningObjective[]> {
  return sb()
    .from("learning_objectives")
    .select("*")
    .eq("topic_id", topicId)
    .neq("status", "archived")
    .order("sequence_number", { nullsFirst: false })
    .then((r) => check(r, [] as LearningObjective[]));
}

export function getTopicPrerequisites(topicId: string): PromiseLike<{ from_topic_id: string; to_topic_id: string; relationship_type: string }[]> {
  return sb()
    .from("topic_relationships")
    .select("from_topic_id, to_topic_id, relationship_type")
    .eq("relationship_type", "prerequisite")
    .or(`to_topic_id.eq.${topicId},from_topic_id.eq.${topicId}`)
    .then((r) => check(r, [] as { from_topic_id: string; to_topic_id: string; relationship_type: string }[]));
}

// ----- curriculum writes (student-authored rows) -----

export async function addTopic(input: {
  course_id: string;
  name: string;
  description?: string | null;
  estimated_minutes?: number | null;
  created_by: string;
  sequence_number?: number | null;
}): Promise<Topic> {
  const { data, error } = await sb()
    .from("topics")
    .insert({ ...input, status: "student_added", source_type: "student" })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data;
}

export async function addSubtopic(input: { topic_id: string; name: string; description?: string | null }): Promise<void> {
  const { error } = await sb().from("subtopics").insert(input);
  if (error) throw new ApiError(error.message);
}

export async function addConcept(input: {
  topic_id: string;
  name: string;
  definition?: string | null;
  formula?: string | null;
  difficulty?: number | null;
  created_by: string;
}): Promise<void> {
  const { error } = await sb().from("concepts").insert({ ...input, status: "active", source_type: "student" });
  if (error) throw new ApiError(error.message);
}

export async function addConceptPrerequisite(prerequisiteId: string, conceptId: string): Promise<void> {
  const { error } = await sb().from("concept_prerequisites").insert({ prerequisite_id: prerequisiteId, concept_id: conceptId });
  if (error) throw new ApiError(error.message);
}

export async function addObjective(input: {
  topic_id: string;
  statement: string;
  created_by: string;
  sequence_number?: number | null;
}): Promise<void> {
  const { error } = await sb().from("learning_objectives").insert({ ...input, status: "active", source_type: "student" });
  if (error) throw new ApiError(error.message);
}

export async function addTopicPrerequisite(fromTopicId: string, toTopicId: string): Promise<void> {
  const { error } = await sb()
    .from("topic_relationships")
    .insert({ from_topic_id: fromTopicId, to_topic_id: toTopicId, relationship_type: "prerequisite" });
  if (error) throw new ApiError(error.message);
}

// ---------------------------------------------------------------------------
// Content (units, questions, practicals, resources)
// ---------------------------------------------------------------------------

export function getUnits(topicId: string): PromiseLike<LearningUnit[]> {
  return sb()
    .from("learning_units")
    .select("*")
    .eq("topic_id", topicId)
    .neq("status", "archived")
    .order("sequence_number", { nullsFirst: false })
    .then((r) => check(r, [] as LearningUnit[]));
}

export function getUnitsByIds(ids: string[]): PromiseLike<LearningUnit[]> {
  if (!ids.length) return Promise.resolve([]);
  return sb().from("learning_units").select("*").in("id", ids).then((r) => check(r, [] as LearningUnit[]));
}

export function getQuestionsByIds(ids: string[]): PromiseLike<Question[]> {
  if (!ids.length) return Promise.resolve([]);
  return sb().from("questions").select("*").in("id", ids).then((r) => check(r, [] as Question[]));
}

export function getPracticalsByIds(ids: string[]): PromiseLike<Practical[]> {
  if (!ids.length) return Promise.resolve([]);
  return sb().from("practicals").select("*").in("id", ids).then((r) => check(r, [] as Practical[]));
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
  const { error } = await sb().from("learning_units").insert({ ...input, status: "approved", source_type: "student" });
  if (error) throw new ApiError(error.message);
}

export function getQuestions(topicId: string, opts: { includeOwnDrafts?: boolean; userId?: string } = {}): PromiseLike<Question[]> {
  let query = sb().from("questions").select("*").eq("topic_id", topicId);
  // RLS only exposes approved questions to others; include own drafts for the author.
  if (opts.includeOwnDrafts && opts.userId) {
    query = query.or(`status.eq.approved,created_by.eq.${opts.userId}`);
  }
  return query
    .neq("status", "retired")
    .order("difficulty")
    .then((r) => check(r, [] as Question[]));
}

export function getQuestionsForConcept(conceptId: string): PromiseLike<Question[]> {
  return sb()
    .from("questions")
    .select("*")
    .eq("concept_id", conceptId)
    .eq("status", "approved")
    .order("difficulty")
    .then((r) => check(r, [] as Question[]));
}

export function getQuestionOptions(questionIds: string[]): PromiseLike<QuestionOption[]> {
  if (!questionIds.length) return Promise.resolve([]);
  return sb().from("question_options").select("*").in("question_id", questionIds).order("sequence_number").then((r) => check(r, [] as QuestionOption[]));
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

export function getPracticals(topicId: string): PromiseLike<Practical[]> {
  return sb().from("practicals").select("*").eq("topic_id", topicId).neq("status", "archived").then((r) => check(r, [] as Practical[]));
}

export function getPracticalSteps(practicalIds: string[]): PromiseLike<PracticalStep[]> {
  if (!practicalIds.length) return Promise.resolve([]);
  return sb().from("practical_steps").select("*").in("practical_id", practicalIds).order("step_number").then((r) => check(r, [] as PracticalStep[]));
}

export async function getResourcesForTopics(topicIds: string[]): Promise<{ resources: Resource[]; links: { topic_id: string; resource_id: string; sequence_number: number | null }[] }> {
  if (!topicIds.length) return Promise.resolve({ resources: [], links: [] });
  const [linksRes, resRes] = await Promise.all([
    sb().from("topic_resources").select("topic_id, resource_id, sequence_number").in("topic_id", topicIds),
    sb().from("content_resources").select("*").neq("status", "archived"),
  ]);
  const links = check(linksRes, [] as { topic_id: string; resource_id: string; sequence_number: number | null }[]);
  const resources = check(resRes, [] as Resource[]);
  const ids = new Set(links.map((l) => l.resource_id));
  return { links, resources: resources.filter((r) => ids.has(r.id)) };
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
  const { data, error } = await sb().from("content_resources").insert({ ...input, status: "active" }).select().single();
  if (error) throw new ApiError(error.message);
  if (input.topic_ids?.length) {
    const { error: linkError } = await sb()
      .from("topic_resources")
      .insert(input.topic_ids.map((topic_id) => ({ topic_id, resource_id: data.id })));
    if (linkError) throw new ApiError(linkError.message);
  }
}

// ---------------------------------------------------------------------------
// Learning sessions
// ---------------------------------------------------------------------------

export function getActiveSession(topicId: string): PromiseLike<LearningSession | null> {
  return sb()
    .from("learning_sessions")
    .select("*")
    .eq("topic_id", topicId)
    .in("status", ["active", "paused"])
    .maybeSingle()
    .then((r) => check(r, null));
}

export function getActiveSessions(): PromiseLike<LearningSession[]> {
  return sb()
    .from("learning_sessions")
    .select("*")
    .in("status", ["active", "paused"])
    .order("updated_at", { ascending: false })
    .then((r) => check(r, [] as LearningSession[]));
}

export function getSession(sessionId: string): PromiseLike<LearningSession | null> {
  return sb().from("learning_sessions").select("*").eq("id", sessionId).maybeSingle().then((r) => check(r, null));
}

export function getSessionSteps(sessionId: string): PromiseLike<SessionStep[]> {
  return sb()
    .from("learning_session_steps")
    .select("*")
    .eq("learning_session_id", sessionId)
    .order("step_number")
    .then((r) => check(r, [] as SessionStep[]));
}

export async function createSessionWithSteps(session: Omit<LearningSession, "id">,
  steps: Omit<SessionStep, "id" | "learning_session_id">[]): Promise<LearningSession> {
  const { data: sessionData, error } = await sb().from("learning_sessions").insert(session).select().single();
  if (error) throw new ApiError(error.message);
  const rows = steps.map((s, i) => ({ ...s, learning_session_id: sessionData.id, status: i === 0 ? "unlocked" : "locked" }));
  const { error: stepsError } = await sb().from("learning_session_steps").insert(rows);
  if (stepsError) throw new ApiError(stepsError.message);
  return sessionData;
}

export async function updateStep(stepId: string,
  patch: Partial<Pick<SessionStep, "status" | "score" | "completed_at" | "duration_seconds" | "metadata">>): Promise<void> {
  const { error } = await sb().from("learning_session_steps").update(patch).eq("id", stepId);
  if (error) throw new ApiError(error.message);
}

export async function markStepsSkipped(stepIds: string[]): Promise<void> {
  if (!stepIds.length) return;
  const { error } = await sb().from("learning_session_steps").update({ status: "skipped" }).in("id", stepIds);
  if (error) throw new ApiError(error.message);
}

export async function setSessionProgress(sessionId: string,
  patch: Partial<Pick<LearningSession, "current_step" | "status" | "diagnostic_score" | "difficulty_floor" | "settings" | "completed_at">>): Promise<void> {
  const { error } = await sb().from("learning_sessions").update(patch).eq("id", sessionId);
  if (error) throw new ApiError(error.message);
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
  const { error } = await sb().from("question_attempts").insert(input);
  if (error) throw new ApiError(error.message);
}

export function countAttempts(questionId: string, sessionId: string | null): PromiseLike<number> {
  return sb()
    .from("question_attempts")
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId)
    .eq("learning_session_id", sessionId)
    .then((r) => (r.error ? 0 : (r.data as unknown as number) ?? 0));
}

export function getAttemptsForQuestions(questionIds: string[]): PromiseLike<{
  student_id: string;
  question_id: string;
  learning_session_id: string | null;
  answer: unknown;
  is_correct: boolean | null;
  score: number | null;
  hints_used: number;
  attempted_at: string;
}[]> {
  if (!questionIds.length) return Promise.resolve([]);
  return sb()
    .from("question_attempts")
    .select("student_id, question_id, learning_session_id, answer, is_correct, score, hints_used, attempted_at")
    .in("question_id", questionIds)
    .order("attempted_at", { ascending: false })
    .then((r) => check(r, [] as {
      student_id: string;
      question_id: string;
      learning_session_id: string | null;
      answer: unknown;
      is_correct: boolean | null;
      score: number | null;
      hints_used: number;
      attempted_at: string;
    }[]));
}

// ---------------------------------------------------------------------------
// Mastery & review
// ---------------------------------------------------------------------------

export function getTopicMastery(): PromiseLike<TopicMastery[]> {
  return sb().from("topic_mastery").select("*").then((r) => check(r, [] as TopicMastery[]));
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
  const { error } = await sb()
    .from("topic_mastery")
    .upsert(input, { onConflict: "student_id,topic_id" });
  if (error) throw new ApiError(error.message);
}

export function getConceptMastery(): PromiseLike<ConceptMastery[]> {
  return sb().from("concept_mastery").select("*").then((r) => check(r, [] as ConceptMastery[]));
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
  const { error } = await sb()
    .from("concept_mastery")
    .upsert(input, { onConflict: "student_id,concept_id" });
  if (error) throw new ApiError(error.message);
}

export function getReviews(): PromiseLike<ReviewItem[]> {
  return sb()
    .from("review_schedule")
    .select("*")
    .eq("status", "scheduled")
    .order("scheduled_for")
    .then((r) => check(r, [] as ReviewItem[]));
}

/**
 * SM-2 keeps a single pending review per topic: update the existing scheduled
 * row in place, or insert a new one.
 */
export async function upsertReview(input: {
  student_id: string;
  topic_id: string;
  scheduled_for: string;
  interval_days: number;
  ease_factor: number;
}): Promise<void> {
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
}

export async function completeReview(reviewId: string): Promise<void> {
  const { error } = await sb().from("review_schedule").update({ status: "completed" }).eq("id", reviewId);
  if (error) throw new ApiError(error.message);
}

// ---------------------------------------------------------------------------
// Recommendations
// ---------------------------------------------------------------------------

export function getActiveRecommendations(): PromiseLike<Recommendation[]> {
  return sb()
    .from("recommendations")
    .select("*")
    .eq("status", "active")
    .order("priority", { ascending: false })
    .then((r) => check(r, [] as Recommendation[]));
}

export async function insertRecommendation(input: {
  student_id: string;
  course_id: string | null;
  topic_id: string | null;
  recommendation_type: string;
  priority: number;
  reason: string;
}): Promise<void> {
  const { error } = await sb().from("recommendations").insert(input);
  if (error) throw new ApiError(error.message);
}

export async function setRecommendationStatus(id: string, status: Recommendation["status"]): Promise<void> {
  const { error } = await sb().from("recommendations").update({ status }).eq("id", id);
  if (error) throw new ApiError(error.message);
}

// ---------------------------------------------------------------------------
// Materials & extraction
// ---------------------------------------------------------------------------

export async function uploadMaterial(input: {
  file: File;
  student_id: string;
  course_id?: string | null;
  topic_id?: string | null;
}): Promise<UploadedMaterial> {
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
      processing_status: "pending",
    })
    .select()
    .single();
  if (rowError) throw new ApiError(rowError.message);
  return data;
}

export function getMaterials(): PromiseLike<UploadedMaterial[]> {
  return sb().from("uploaded_materials").select("*").order("created_at", { ascending: false }).then((r) => check(r, [] as UploadedMaterial[]));
}

export function getExtractedItems(materialId: string): PromiseLike<ExtractedItem[]> {
  return sb()
    .from("extracted_content")
    .select("*")
    .eq("material_id", materialId)
    .order("source_page", { nullsFirst: true })
    .then((r) => check(r, [] as ExtractedItem[]));
}

export async function requestMaterialProcessing(materialId: string): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await sb().functions.invoke("process-material", { body: { material_id: materialId } });
  if (error) {
    return { ok: false, message: error.message ?? "Edge Function unavailable" };
  }
  const body = data as { ok?: boolean; message?: string } | null;
  return { ok: body?.ok ?? false, message: body?.message ?? "" };
}

export async function deleteMaterial(materialId: string): Promise<void> {
  const { data, error } = await sb().from("uploaded_materials").select("storage_path").eq("id", materialId).single();
  if (error) throw new ApiError(error.message);
  await sb().storage.from("student-materials").remove([data.storage_path]);
  const { error: delError } = await sb().from("uploaded_materials").delete().eq("id", materialId);
  if (delError) throw new ApiError(delError.message);
}

// ---------------------------------------------------------------------------
// AI (Edge Functions — server-side; no keys in the browser)
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
  const { data, error } = await sb().functions.invoke("ai-tutor", { body: payload });
  if (error) throw new ApiError(error.message ?? "AI service unavailable", "ai_unavailable");
  if (data && typeof data === "object" && (data as { error_code?: string }).error_code === "ai_not_configured") {
    throw new ApiError("The AI provider is not configured for this deployment.", "ai_not_configured");
  }
  return data as AiReply;
}

export function getConversations(): PromiseLike<AiConversation[]> {
  return sb().from("ai_conversations").select("*").order("updated_at", { ascending: false }).then((r) => check(r, [] as AiConversation[]));
}

export async function createConversation(input: {
  student_id: string;
  course_id?: string | null;
  topic_id?: string | null;
  mode?: AiConversation["mode"];
  title?: string | null;
}): Promise<AiConversation> {
  const { data, error } = await sb().from("ai_conversations").insert(input).select().single();
  if (error) throw new ApiError(error.message);
  return data;
}

export function getConversationMessages(conversationId: string): PromiseLike<AiMessage[]> {
  return sb()
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at")
    .then((r) => check(r, [] as AiMessage[]));
}

export async function addMessage(input: {
  conversation_id: string;
  role: AiMessage["role"];
  content: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await sb().from("ai_messages").insert(input);
  if (error) throw new ApiError(error.message);
}

export function getExplainBackAttempts(topicId?: string): PromiseLike<ExplainBackAttempt[]> {
  let q = sb().from("explain_back_attempts").select("*").order("created_at", { ascending: false });
  if (topicId) q = q.eq("topic_id", topicId);
  return q.then((r) => check(r, [] as ExplainBackAttempt[]));
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
  const { data, error } = await sb().from("explain_back_attempts").insert(input).select().single();
  if (error) throw new ApiError(error.message);
  return data;
}

export async function updateExplainBackAttempt(id: string,
  patch: { ai_feedback?: Record<string, unknown> | null; score?: number | null }): Promise<void> {
  const { error } = await sb().from("explain_back_attempts").update(patch).eq("id", id);
  if (error) throw new ApiError(error.message);
}

// ---------------------------------------------------------------------------
// Assessments (Phase 5)
// ---------------------------------------------------------------------------

export function getAssessments(courseId: string): PromiseLike<Assessment[]> {
  return sb()
    .from("assessments")
    .select("*")
    .eq("course_id", courseId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .then((r) => check(r, [] as Assessment[]));
}

export function getAssessment(id: string): PromiseLike<Assessment | null> {
  return sb().from("assessments").select("*").eq("id", id).maybeSingle().then((r) => check(r, null));
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

export async function updateAssessment(
  id: string,
  patch: Partial<Pick<Assessment, "title" | "description" | "question_ids" | "pass_percent" | "time_limit_seconds" | "status">>,
): Promise<void> {
  const { error } = await sb().from("assessments").update(patch).eq("id", id);
  if (error) throw new ApiError(error.message);
}

export async function deleteAssessment(id: string): Promise<void> {
  const { error } = await sb().from("assessments").delete().eq("id", id);
  if (error) throw new ApiError(error.message);
}

export async function startAssessmentAttempt(input: {
  student_id: string;
  assessment_id: string;
  learning_session_id?: string | null;
}): Promise<AssessmentAttempt> {
  const { data, error } = await sb()
    .from("assessment_attempts")
    .insert({ ...input, learning_session_id: input.learning_session_id ?? null })
    .select()
    .single();
  if (error) throw new ApiError(error.message);
  return data;
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
  const { error } = await sb().from("assessment_attempts").update(patch).eq("id", id);
  if (error) throw new ApiError(error.message);
}

export function getMyAssessmentAttempts(assessmentId?: string): PromiseLike<AssessmentAttempt[]> {
  let q = sb().from("assessment_attempts").select("*").order("created_at", { ascending: false });
  if (assessmentId) q = q.eq("assessment_id", assessmentId);
  return q.then((r) => check(r, [] as AssessmentAttempt[]));
}

// ---------------------------------------------------------------------------
// Practical activities (Phase 9)
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
  const { error } = await sb().from("activity_attempts").insert(input);
  if (error) throw new ApiError(error.message);
}

export function getMyActivityAttempts(limit = 20): PromiseLike<ActivityAttempt[]> {
  return sb()
    .from("activity_attempts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .then((r) => check(r, [] as ActivityAttempt[]));
}
