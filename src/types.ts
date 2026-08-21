// Domain types mirroring supabase/migrations/0001_studylab_v0_1.sql

export type UUID = string;

export interface Institution {
  id: UUID;
  name: string;
  short_name: string | null;
  country: string | null;
  website_url: string | null;
  is_active: boolean;
}

export interface Programme {
  id: UUID;
  institution_id: UUID;
  name: string;
  code: string | null;
  description: string | null;
  duration_years: number | null;
  is_active: boolean;
}

export interface AcademicPeriod {
  id: UUID;
  programme_id: UUID;
  academic_year: number;
  year_level: number;
  semester: 1 | 2;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "active" | "completed" | "archived";
}

export type CourseStatus = "confirmed" | "provisional" | "student_added" | "archived";

export interface Course {
  id: UUID;
  programme_id: UUID;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  credits: number | null;
  course_type: string | null;
  status: CourseStatus;
  source_type: string | null;
}

export interface CourseOffering {
  id: UUID;
  course_id: UUID;
  academic_period_id: UUID;
  lecturer_name: string | null;
  status: "planned" | "active" | "completed" | "archived";
}

export type TopicStatus = "draft" | "confirmed" | "student_added" | "archived";

export interface Topic {
  id: UUID;
  course_id: UUID;
  name: string;
  description: string | null;
  sequence_number: number | null;
  status: TopicStatus;
  source_type: string | null;
  source_reference: string | null;
  estimated_minutes: number | null;
}

export interface Subtopic {
  id: UUID;
  topic_id: UUID;
  name: string;
  description: string | null;
  sequence_number: number | null;
  status: "draft" | "active" | "archived";
}

export interface Skill {
  id: UUID;
  name: string;
  description: string | null;
  skill_type: string | null;
}

export interface TopicSkill {
  topic_id: UUID;
  skill_id: UUID;
  importance: number;
}

export type UnitType =
  | "explanation"
  | "video"
  | "worked_example"
  | "interactive"
  | "practical"
  | "practice"
  | "reflection"
  | "review";

export interface LearningUnit {
  id: UUID;
  topic_id: UUID;
  subtopic_id: UUID | null;
  title: string;
  unit_type: UnitType;
  sequence_number: number | null;
  description: string | null;
  body: string | null;
  estimated_minutes: number | null;
  difficulty: number | null;
  status: "draft" | "review" | "approved" | "archived";
}

export type ResourceType =
  | "youtube"
  | "document"
  | "website"
  | "textbook"
  | "simulation"
  | "image"
  | "other";

export interface ContentResource {
  id: UUID;
  title: string;
  description: string | null;
  resource_type: ResourceType;
  url: string | null;
  provider: string | null;
  author: string | null;
  duration_seconds: number | null;
  difficulty: number | null;
  status: "draft" | "active" | "unavailable" | "archived";
  source_type: string | null;
}

export interface TopicResource {
  topic_id: UUID;
  resource_id: UUID;
  relationship_type: string;
  sequence_number: number | null;
}

export type QuestionType =
  | "multiple_choice"
  | "short_answer"
  | "numeric"
  | "true_false"
  | "matching"
  | "scenario";

export interface Question {
  id: UUID;
  topic_id: UUID;
  subtopic_id: UUID | null;
  question_type: QuestionType;
  difficulty: number;
  question_text: string;
  explanation: string | null;
  hint_1: string | null;
  hint_2: string | null;
  correct_answer: { key?: string; value?: string; number?: number };
  estimated_seconds: number | null;
  status: "draft" | "review" | "approved" | "retired";
}

export interface QuestionOption {
  id: UUID;
  question_id: UUID;
  option_key: string;
  option_text: string;
  sequence_number: number;
}

export interface Practical {
  id: UUID;
  topic_id: UUID;
  title: string;
  objective: string | null;
  background: string | null;
  materials: string[];
  safety_notes: string | null;
  expected_outcome: string | null;
  assessment_notes: string | null;
  status: "draft" | "review" | "approved" | "archived";
}

export interface PracticalStep {
  id: UUID;
  practical_id: UUID;
  step_number: number;
  instruction: string;
  expected_action: string | null;
  observation_prompt: string | null;
}

export interface StudentProfile {
  id: UUID;
  full_name: string;
  institution_id: UUID | null;
  programme_id: UUID | null;
  current_year: number;
  current_semester: number;
  timezone: string;
  study_preferences: Record<string, unknown>;
}

export interface Enrolment {
  id: UUID;
  student_id: UUID;
  programme_id: UUID;
  academic_period_id: UUID;
  status: "active" | "completed" | "withdrawn";
  started_at: string;
  ended_at: string | null;
}

export interface StudentCourseEnrolment {
  id: UUID;
  student_id: UUID;
  course_offering_id: UUID;
  status: "active" | "completed" | "withdrawn";
}

export type SessionType = "free_study" | "recommended" | "exam_prep" | "revision" | "practice";

export interface StudySession {
  id: UUID;
  student_id: UUID;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  session_type: SessionType;
  topic_id: UUID | null;
  note: string | null;
}

export interface LearningAttempt {
  id: UUID;
  student_id: UUID;
  learning_unit_id: UUID;
  study_session_id: UUID | null;
  started_at: string;
  completed_at: string | null;
  completion_percent: number;
}

export interface QuestionAttempt {
  id: UUID;
  student_id: UUID;
  question_id: UUID;
  study_session_id: UUID | null;
  answer: unknown;
  is_correct: boolean;
  score: number;
  time_seconds: number;
  confidence: number | null;
  hints_used: number;
  attempted_at: string;
}

export type MasteryLevel =
  | "not_started"
  | "learning"
  | "developing"
  | "functional"
  | "strong"
  | "mastered";

export interface TopicMastery {
  id: UUID;
  student_id: UUID;
  topic_id: UUID;
  mastery_score: number;
  mastery_level: MasteryLevel;
  confidence_score: number;
  attempt_count: number;
  last_practiced_at: string | null;
  last_assessed_at: string | null;
  next_review_at: string | null;
}

export interface SkillMastery {
  id: UUID;
  student_id: UUID;
  skill_id: UUID;
  mastery_score: number;
  confidence_score: number;
  attempt_count: number;
  last_assessed_at: string | null;
}

export type ReviewStatus = "scheduled" | "completed" | "skipped" | "cancelled";

export interface ReviewSchedule {
  id: UUID;
  student_id: UUID;
  topic_id: UUID;
  scheduled_for: string;
  interval_days: number;
  ease_factor: number;
  status: ReviewStatus;
  last_result: number | null;
}

export type RecommendationType =
  | "start_topic"
  | "continue_unit"
  | "practice"
  | "review"
  | "upload_material"
  | "practical";
export type RecommendationStatus = "active" | "accepted" | "dismissed" | "expired";

export interface Recommendation {
  id: UUID;
  student_id: UUID;
  course_id: UUID | null;
  topic_id: UUID | null;
  recommendation_type: RecommendationType;
  priority: number;
  reason: string;
  minutes: number;
  expires_at: string | null;
  status: RecommendationStatus;
}

export type PlanStatus = "draft" | "active" | "completed" | "cancelled";

export interface StudyPlan {
  id: UUID;
  student_id: UUID;
  name: string;
  start_date: string;
  end_date: string;
  target_minutes: number;
  status: PlanStatus;
}

export interface StudyPlanItem {
  id: UUID;
  study_plan_id: UUID;
  topic_id: UUID | null;
  title: string;
  scheduled_date: string;
  planned_minutes: number;
  sequence_number: number;
  status: "planned" | "started" | "completed" | "skipped";
}

export type ProcessingStatus = "pending" | "processing" | "ready" | "failed";

export interface UploadedMaterial {
  id: UUID;
  student_id: UUID;
  course_id: UUID | null;
  topic_id: UUID | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number;
  processing_status: ProcessingStatus;
  extracted_text: string | null;
  ai_classification: Record<string, unknown> | null;
  created_at: string;
}

export type AIMode = "tutor" | "explain" | "practice" | "revision" | "exam_prep" | "material_analysis";

export interface AIConversation {
  id: UUID;
  student_id: UUID;
  course_id: UUID | null;
  topic_id: UUID | null;
  mode: AIMode;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: UUID;
  conversation_id: UUID;
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Database {
  institutions: Institution[];
  programmes: Programme[];
  academic_periods: AcademicPeriod[];
  courses: Course[];
  course_offerings: CourseOffering[];
  topics: Topic[];
  subtopics: Subtopic[];
  skills: Skill[];
  topic_skills: TopicSkill[];
  learning_units: LearningUnit[];
  content_resources: ContentResource[];
  topic_resources: TopicResource[];
  questions: Question[];
  question_options: QuestionOption[];
  practicals: Practical[];
  practical_steps: PracticalStep[];
  student_profiles: StudentProfile[];
  enrolments: Enrolment[];
  student_course_enrolments: StudentCourseEnrolment[];
  study_sessions: StudySession[];
  learning_attempts: LearningAttempt[];
  question_attempts: QuestionAttempt[];
  topic_mastery: TopicMastery[];
  skill_mastery: SkillMastery[];
  review_schedule: ReviewSchedule[];
  recommendations: Recommendation[];
  study_plans: StudyPlan[];
  study_plan_items: StudyPlanItem[];
  uploaded_materials: UploadedMaterial[];
  ai_conversations: AIConversation[];
  ai_messages: AIMessage[];
}
