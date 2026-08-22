import { supabase, ALL_TABLES, type TableName } from "./supabase";
import { store } from "../store";
import type { Database } from "../types";

const EMPTY_DB: Database = {
  institutions: [], programmes: [], academic_periods: [], courses: [], course_offerings: [],
  topics: [], subtopics: [], skills: [], topic_skills: [], learning_units: [],
  content_resources: [], topic_resources: [], questions: [], question_options: [],
  practicals: [], practical_steps: [], student_profiles: [], enrolments: [],
  student_course_enrolments: [], study_sessions: [], learning_attempts: [],
  question_attempts: [], topic_mastery: [], skill_mastery: [], review_schedule: [],
  recommendations: [], study_plans: [], study_plan_items: [], uploaded_materials: [],
  ai_conversations: [], ai_messages: [],
};

/** Fetch every table row the signed-in student can see and hydrate the store. */
export async function hydrateFromSupabase(): Promise<Database> {
  if (!supabase) throw new Error("Supabase not configured");
  const db: Database = structuredClone(EMPTY_DB);

  for (const table of ALL_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      // Non-fatal: RLS may hide a table or it may not yet be migrated.
      console.warn(`[live] could not load ${table}:`, error.message);
      continue;
    }
    (db[table as keyof Database] as unknown[]) = (data ?? []) as unknown[];
  }
  return db;
}

/** Push a single student-authored row up to Supabase (upsert by id). Returns error message or null. */
export async function upsertRow(table: TableName, row: unknown): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from(table).upsert(row as never);
  if (error) {
    console.warn(`[live] upsert ${table} failed:`, error.message);
    return error.message;
  }
  return null;
}

export async function deleteRow(table: TableName, id: string): Promise<string | null> {
  if (!supabase) return null;
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) { console.warn(`[live] delete ${table} failed:`, error.message); return error.message; }
  return null;
}

/** Upload a file to the private student-materials bucket and return its storage path. */
export async function uploadFile(userId: string, file: File): Promise<{ path: string; error: string | null }> {
  if (!supabase) return { path: "", error: "Supabase not configured" };
  const storagePath = `${userId}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("student-materials").upload(storagePath, file, {
    cacheControl: "3600", upsert: false, contentType: file.type || "application/octet-stream",
  });
  return { path: error ? "" : storagePath, error: error ? error.message : null };
}

/** Create a short-lived signed URL for a private stored file. */
export async function getFileUrl(storagePath: string): Promise<string | null> {
  if (!supabase || !storagePath) return null;
  const { data } = await supabase.storage.from("student-materials").createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

/** Tables a student can write to directly (student-owned). */
const WRITABLE_STUDENT_TABLES = new Set<TableName>([
  "student_profiles", "enrolments", "student_course_enrolments", "study_sessions",
  "learning_attempts", "question_attempts", "topic_mastery", "skill_mastery",
  "review_schedule", "recommendations", "study_plans", "study_plan_items",
  "uploaded_materials", "ai_conversations", "ai_messages",
  "topics", "subtopics", "learning_units", "content_resources", "topic_resources",
  "questions", "question_options", "practicals", "practical_steps", "skills", "topic_skills",
]);

export function isWritable(table: TableName) {
  return WRITABLE_STUDENT_TABLES.has(table);
}

/** Subscribe to auth state; resolves with the current session. */
export function onAuthChange(cb: (userId: string | null) => void) {
  if (!supabase) return () => {};
  supabase.auth.getSession().then(({ data }) => cb(data.session?.user.id ?? null));
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user.id ?? null);
  });
  return () => sub.subscription.unsubscribe();
}

export async function signIn(email: string, password: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, fullName: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { data, error } = await supabase.auth.signUp({
    email, password, options: { data: { full_name: fullName } },
  });
  if (error) throw error;
  return data.user;
}

export async function signInWithMagicLink(email: string) {
  if (!supabase) throw new Error("Supabase not configured");
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
  store.reset();
}
