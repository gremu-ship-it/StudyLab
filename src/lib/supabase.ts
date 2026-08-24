import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  hostOf,
  normalizeAnonKey,
  normalizeProjectUrl,
  validateSupabaseConfig,
  type SupabaseConfig,
} from "./supabase-config";

const STORAGE_URL = "studylab.supabase.url";
const STORAGE_ANON_KEY = "studylab.supabase.anonKey";

/** Read a pair saved from the Setup screen. Invalid or unreadable ⇒ null. */
function readBrowserConfig(): { url: string; anonKey: string } | null {
  try {
    const url = window.localStorage.getItem(STORAGE_URL);
    const anonKey = window.localStorage.getItem(STORAGE_ANON_KEY);
    if (!url || !anonKey) return null;
    // Ignore anything stale or mis-pasted rather than booting into a broken client.
    if (validateSupabaseConfig(url, anonKey)) return null;
    return { url, anonKey };
  } catch {
    return null; // storage blocked (private mode) or no window (unit tests)
  }
}

const envUrl = normalizeProjectUrl((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "");
const envAnonKey = normalizeAnonKey(
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "",
);

/**
 * Build-time environment variables win; a pair saved in this browser from the
 * Setup screen is the fallback. `source` says which one produced the client so
 * the UI can be honest about where the connection came from.
 */
export const activeConfig: SupabaseConfig | null =
  envUrl && envAnonKey && !validateSupabaseConfig(envUrl, envAnonKey)
    ? { url: envUrl, anonKey: envAnonKey, source: "env" }
    : (() => {
        const browser = readBrowserConfig();
        return browser ? { url: browser.url, anonKey: browser.anonKey, source: "browser" as const } : null;
      })();

/** True when a Supabase backend is reachable (Live mode after sign-in). */
export const isSupabaseConfigured = Boolean(activeConfig);

export const supabase: SupabaseClient | null = activeConfig
  ? createClient(activeConfig.url, activeConfig.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/** Human-readable "connected to …" label, or null when unconfigured. */
export function connectionLabel(): string | null {
  if (!activeConfig) return null;
  return activeConfig.source === "env"
    ? `build-time env vars → ${hostOf(activeConfig.url)}`
    : `this browser → ${hostOf(activeConfig.url)}`;
}

/**
 * Save a pair for this browser only. Returns an error message, or null on
 * success — the caller reloads so the client above is rebuilt from storage.
 */
export function saveBrowserConfig(url: string, anonKey: string): string | null {
  const cleanUrl = normalizeProjectUrl(url);
  const cleanKey = normalizeAnonKey(anonKey);
  const error = validateSupabaseConfig(cleanUrl, cleanKey);
  if (error) return error;
  try {
    window.localStorage.setItem(STORAGE_URL, cleanUrl);
    window.localStorage.setItem(STORAGE_ANON_KEY, cleanKey);
  } catch {
    return "This browser refused to store the connection (private mode?). Use the VITE_SUPABASE_* environment variables instead.";
  }
  return null;
}

/** Forget the browser-saved pair (build-time env vars are unaffected). */
export function clearBrowserConfig(): void {
  try {
    window.localStorage.removeItem(STORAGE_URL);
    window.localStorage.removeItem(STORAGE_ANON_KEY);
  } catch {
    /* nothing stored */
  }
}

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
