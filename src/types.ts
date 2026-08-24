// Domain types mirroring the PostgreSQL schema (supabase/migrations).
// Only the fields the frontend reads/writes are modelled here.

export type Id = string;

export type UnitType =
  | "explanation"
  | "video"
  | "worked_example"
  | "interactive"
  | "practical"
  | "practice"
  | "reflection"
  | "review";

export type QuestionType =
  | "multiple_choice"
  | "short_answer"
  | "numeric"
  | "true_false"
  | "matching"
  | "ordering"
  | "scenario";

export type StepType =
  | "objective"
  | "diagnostic"
  | "explanation"
  | "definition"
  | "example"
  | "worked_example"
  | "visual"
  | "practice"
  | "application"
  | "practical"
  | "assessment"
  | "reflection"
  | "mastery";

export type StepStatus = "locked" | "unlocked" | "in_progress" | "completed" | "skipped";

export type MasteryLevel = "not_assessed" | "weak" | "developing" | "strong" | "mastered";

export type SourceLevel = 1 | 2 | 3 | 4;

// ---------- Curriculum ----------

export interface Institution {
  id: Id;
  name: string;
  short_name: string | null;
  country: string | null;
}

export interface Programme {
  id: Id;
  institution_id: Id;
  name: string;
  code: string | null;
  description: string | null;
  duration_years: number | null;
  is_active: boolean;
}

export interface AcademicPeriod {
  id: Id;
  programme_id: Id;
  academic_year: number;
  year_level: number;
  semester: number;
  name: string;
  status: "draft" | "active" | "completed" | "archived";
}

export interface Course {
  id: Id;
  programme_id: Id;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  credits: number | null;
  status: "confirmed" | "provisional" | "student_added" | "archived";
  source_type: string | null;
  created_at: string;
}

export interface Topic {
  id: Id;
  course_id: Id;
  name: string;
  description: string | null;
  sequence_number: number | null;
  status: "draft" | "confirmed" | "student_added" | "archived";
  source_type: string | null;
  source_reference: string | null;
  estimated_minutes: number | null;
  created_by: Id | null;
  created_at: string;
}

export interface Subtopic {
  id: Id;
  topic_id: Id;
  name: string;
  description: string | null;
  sequence_number: number | null;
  status: "draft" | "active" | "archived";
}

export interface Concept {
  id: Id;
  topic_id: Id;
  name: string;
  description: string | null;
  definition: string | null;
  formula: string | null;
  difficulty: number | null;
  sequence_number: number | null;
  status: "draft" | "active" | "archived";
  source_type: string | null;
  created_by: Id | null;
}

export interface ConceptPrerequisite {
  id: Id;
  prerequisite_id: Id;
  concept_id: Id;
  confidence: number;
}

export interface Skill {
  id: Id;
  name: string;
  description: string | null;
  skill_type: string | null;
}

export interface LearningObjective {
  id: Id;
  course_id: Id | null;
  topic_id: Id | null;
  concept_id: Id | null;
  statement: string;
  sequence_number: number | null;
  status: "draft" | "active" | "archived";
  source_type: string | null;
  created_by: Id | null;
}

// ---------- Content ----------

export interface LearningUnit {
  id: Id;
  topic_id: Id;
  subtopic_id: Id | null;
  title: string;
  unit_type: UnitType;
  sequence_number: number | null;
  description: string | null;
  body: string | null;
  formula: string | null;
  media: Record<string, unknown>;
  estimated_minutes: number | null;
  difficulty: number | null;
  status: "draft" | "review" | "approved" | "archived";
  source_type: string | null;
  source_reference: string | null;
  created_by: Id | null;
}

export interface QuestionOption {
  id: Id;
  question_id: Id;
  option_key: string;
  option_text: string;
  sequence_number: number;
}

export interface QuestionScaffolding {
  guiding_question?: string;
  partial_help?: string;
  solution_walkthrough?: string;
  why_it_works?: string;
  similar_question_id?: Id | null;
}

export interface Question {
  id: Id;
  topic_id: Id;
  subtopic_id: Id | null;
  question_type: QuestionType;
  difficulty: number;
  question_text: string;
  explanation: string | null;
  hint_1: string | null;
  hint_2: string | null;
  correct_answer: unknown;
  is_diagnostic: boolean;
  scaffolding: QuestionScaffolding;
  status: "draft" | "review" | "approved" | "retired";
  concept_id: Id | null;
  skill_id: Id | null;
  learning_objective_id: Id | null;
  created_by: Id | null;
}

export interface PracticalStep {
  id: Id;
  practical_id: Id;
  step_number: number;
  instruction: string;
  expected_action: string | null;
  observation_prompt: string | null;
}

export interface Practical {
  id: Id;
  topic_id: Id;
  title: string;
  objective: string | null;
  background: string | null;
  materials: unknown;
  safety_notes: string | null;
  procedure: unknown;
  expected_outcome: string | null;
  status: "draft" | "review" | "approved" | "archived";
}

export interface Resource {
  id: Id;
  title: string;
  description: string | null;
  resource_type: "youtube" | "document" | "website" | "textbook" | "simulation" | "image" | "other";
  url: string | null;
  provider: string | null;
  author: string | null;
  duration_seconds: number | null;
  difficulty: number | null;
  status: "draft" | "active" | "unavailable" | "archived";
  source_level: SourceLevel | null;
  provenance: Record<string, unknown>;
}

export interface TopicResource {
  topic_id: Id;
  resource_id: Id;
  relationship_type: string;
  sequence_number: number | null;
}

// ---------- Sessions & attempts ----------

export interface LearningSession {
  id: Id;
  student_id: Id;
  topic_id: Id;
  study_session_id: Id | null;
  title: string | null;
  status: "active" | "paused" | "completed" | "abandoned";
  current_step: number;
  difficulty_floor: number | null;
  diagnostic_score: number | null;
  started_at: string;
  completed_at: string | null;
  settings: Record<string, unknown>;
}

export interface SessionStep {
  id: Id;
  learning_session_id: Id;
  learning_unit_id: Id | null;
  question_id: Id | null;
  practical_id: Id | null;
  step_number: number;
  step_type: StepType;
  title: string;
  status: StepStatus;
  completed_at: string | null;
  score: number | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown>;
}

export interface QuestionAttempt {
  id: Id;
  student_id: Id;
  question_id: Id;
  learning_session_id: Id | null;
  study_session_id: Id | null;
  answer: unknown;
  is_correct: boolean | null;
  score: number | null;
  time_seconds: number | null;
  hints_used: number;
  attempt_number: number;
  attempted_at: string;
}

// ---------- Mastery & scheduling ----------

export interface TopicMastery {
  id: Id;
  student_id: Id;
  topic_id: Id;
  mastery_score: number;
  mastery_level: string;
  confidence_score: number;
  attempt_count: number;
  last_practiced_at: string | null;
  last_assessed_at: string | null;
  next_review_at: string | null;
}

export interface ConceptMastery {
  id: Id;
  student_id: Id;
  concept_id: Id;
  mastery_score: number;
  mastery_level: MasteryLevel;
  confidence_score: number;
  attempt_count: number;
  last_assessed_at: string | null;
}

export interface ReviewItem {
  id: Id;
  student_id: Id;
  topic_id: Id;
  scheduled_for: string;
  interval_days: number;
  ease_factor: number;
  status: "scheduled" | "completed" | "skipped" | "cancelled";
}

export interface Recommendation {
  id: Id;
  student_id: Id;
  course_id: Id | null;
  topic_id: Id | null;
  recommendation_type: string;
  priority: number;
  reason: string;
  status: "active" | "accepted" | "dismissed" | "expired";
  created_at: string;
}

// ---------- Materials & AI ----------

export interface UploadedMaterial {
  id: Id;
  student_id: Id;
  course_id: Id | null;
  topic_id: Id | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  processing_status: "pending" | "processing" | "ready" | "failed";
  processing_error: string | null;
  extracted_text: string | null;
  page_count: number | null;
  ai_classification: Record<string, unknown> | null;
  created_at: string;
}

export interface ExtractedItem {
  id: Id;
  material_id: Id;
  item_type:
    | "heading"
    | "definition"
    | "formula"
    | "example"
    | "question"
    | "objective"
    | "activity"
    | "concept"
    | "relationship";
  content: string;
  heading: string | null;
  source_page: number | null;
  confidence: number;
  concept_id: Id | null;
  question_id: Id | null;
}

export interface AiConversation {
  id: Id;
  student_id: Id;
  course_id: Id | null;
  topic_id: Id | null;
  mode: "tutor" | "explain" | "practice" | "revision" | "exam_prep" | "material_analysis";
  title: string | null;
  created_at: string;
}

export interface AiMessage {
  id: Id;
  conversation_id: Id;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ExplainBackAttempt {
  id: Id;
  student_id: Id;
  topic_id: Id | null;
  concept_id: Id | null;
  prompt: string;
  student_response: string;
  ai_feedback: Record<string, unknown> | null;
  score: number | null;
  created_at: string;
}

// ---------- Assessments (Phase 5) ----------

export interface Assessment {
  id: Id;
  course_id: Id | null;
  topic_id: Id | null;
  title: string;
  description: string | null;
  question_ids: Id[];
  pass_percent: number;
  time_limit_seconds: number | null;
  status: "draft" | "review" | "approved" | "archived";
  source_type: string | null;
  created_by: Id | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionResult {
  question_id: Id;
  score: number;
  correct: boolean | null;
  hints_used: number;
  time_seconds: number | null;
  answer: unknown;
}

export interface AssessmentAttempt {
  id: Id;
  student_id: Id;
  assessment_id: Id;
  learning_session_id: Id | null;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  passed: boolean | null;
  question_results: QuestionResult[];
  created_at: string;
}

// ---------- Practical activities (Phase 9) ----------

export interface ActivityAttempt {
  id: Id;
  student_id: Id;
  activity_type: string;
  subject: string | null;
  scenario: Record<string, unknown>;
  answer: Record<string, unknown>;
  is_correct: boolean | null;
  score: number | null;
  time_seconds: number | null;
  created_at: string;
}

// ---------- Student ----------

export interface StudentProfile {
  id: Id;
  full_name: string | null;
  institution_id: Id | null;
  programme_id: Id | null;
  current_year: number | null;
  current_semester: number | null;
  timezone: string | null;
  study_preferences: Record<string, unknown>;
}

export interface Enrolment {
  id: Id;
  student_id: Id;
  programme_id: Id;
  academic_period_id: Id;
  status: "active" | "completed" | "withdrawn";
}

export interface User {
  id: Id;
  email: string;
}
