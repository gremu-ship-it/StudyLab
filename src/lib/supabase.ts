import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when Supabase env vars are configured (the app can run in Live mode after sign-in). */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** Tables that hold curriculum/content (readable by all authenticated students). */
export const CURRICULUM_TABLES = [
  "institutions", "programmes", "academic_periods", "courses", "course_offerings",
  "topics", "subtopics", "skills", "topic_skills", "learning_units",
  "content_resources", "topic_resources", "questions", "question_options",
  "practicals", "practical_steps",
] as const;

/** Tables that hold per-student data (each student sees only their own rows via RLS). */
export const STUDENT_TABLES = [
  "student_profiles", "enrolments", "student_course_enrolments", "study_sessions",
  "learning_attempts", "question_attempts", "topic_mastery", "skill_mastery",
  "review_schedule", "recommendations", "study_plans", "study_plan_items",
  "uploaded_materials", "ai_conversations", "ai_messages",
] as const;

export type TableName = typeof CURRICULUM_TABLES[number] | typeof STUDENT_TABLES[number];
export const ALL_TABLES: TableName[] = [...CURRICULUM_TABLES, ...STUDENT_TABLES];
