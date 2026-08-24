// Supabase connection config — pure helpers, covered by test/supabase-config.test.ts.
//
// A deployment can be pointed at a Supabase project in two ways, in priority
// order (see lib/supabase.ts):
//   1. build-time env vars  VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
//   2. a pair saved in this browser from the Setup screen (localStorage)
//
// The client key is public by design — it ships in the bundle either way and
// RLS is the security boundary. What must never end up in a browser is a
// SECRET key, so the validators below reject those explicitly.
//
// Supabase has two client-key formats, both accepted by the API gateway:
//   legacy anon  — an HS256 JWT, starts with "eyJ", payload carries "role":"anon"
//   publishable  — an opaque token, starts with "sb_publishable_"
// and two privileged ones that are rejected here:
//   legacy service_role — a JWT whose payload carries "role":"service_role"
//   secret              — starts with "sb_secret_"

export type ConfigSource = "env" | "browser";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: ConfigSource;
}

export type ApiKeyKind =
  | "legacy-anon"
  | "legacy-service-role"
  | "publishable"
  | "secret"
  | "unknown";

/** Trim, unwrap stray quotes and drop trailing slashes. */
export function normalizeProjectUrl(raw: string): string {
  return raw.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\/+$/, "");
}

/** Trim, unwrap stray quotes and remove line breaks introduced by pasting. */
export function normalizeAnonKey(raw: string): string {
  return raw.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, "");
}

/** Decode the payload of a legacy HS256 key, or null when it is not one. */
export function readJwtPayload(key: string): Record<string, unknown> | null {
  const parts = key.split(".");
  if (parts.length < 2) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = atob(padded);
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Classify a Supabase API key well enough to keep secrets out of the browser. */
export function inspectApiKey(key: string): ApiKeyKind {
  if (key.startsWith("sb_secret")) return "secret";
  if (key.startsWith("sb_publishable")) return "publishable";
  if (key.startsWith("eyJ")) {
    const payload = readJwtPayload(key);
    const role = payload?.role;
    if (role === "service_role") return "legacy-service-role";
    if (role === "anon" || role === "authenticated") return "legacy-anon";
    return "unknown";
  }
  return "unknown";
}

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/** True for a local Supabase stack (supabase start / docker) — http is fine there. */
export function isLocalhostUrl(url: string): boolean {
  try {
    return LOCAL_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Hostname only, for honest "connected to …" labels in the UI. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

/**
 * Validate a URL + client-key pair. Returns null when usable, otherwise a
 * sentence explaining what to fix (shown verbatim in the UI).
 */
export function validateSupabaseConfig(url: string, anonKey: string): string | null {
  if (!url) return "Enter your Supabase Project URL.";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'That URL cannot be parsed. Paste the full Project URL, e.g. "https://your-project.supabase.co".';
  }
  if (!parsed.hostname) return "That URL has no host. Paste the full Project URL.";

  const local = LOCAL_HOSTNAMES.has(parsed.hostname);
  if (parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) {
    return local
      ? 'Include the scheme, e.g. "http://localhost:54321".'
      : `Use the https:// Project URL from Supabase — got "${parsed.protocol}//".`;
  }

  if (!anonKey) return "Enter the anon (publishable) key.";

  const kind = inspectApiKey(anonKey);
  if (kind === "secret" || kind === "legacy-service-role") {
    return "That is a SECRET key (it bypasses RLS) and must never be in a browser. Use the anon / publishable key from Project Settings → API Keys.";
  }
  if (kind === "unknown" && anonKey.length < 20) {
    return 'That is too short to be a Supabase API key. Copy the anon / publishable key from Project Settings → API Keys.';
  }
  return null;
}
