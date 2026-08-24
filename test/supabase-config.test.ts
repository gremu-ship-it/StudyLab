import { describe, expect, it } from "vitest";

import {
  hostOf,
  inspectApiKey,
  isLocalhostUrl,
  normalizeAnonKey,
  normalizeProjectUrl,
  readJwtPayload,
  validateSupabaseConfig,
} from "../src/lib/supabase-config";

// A real-shaped legacy anon key: {"role":"anon","iss":"supabase"} signed with a
// throwaway secret. Only the payload matters to the classifier.
const LEGACY_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  btoa(JSON.stringify({ role: "anon", iss: "supabase", iat: 1700000000 }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "") +
  ".signature-signature-signature";

const LEGACY_SERVICE_ROLE =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  btoa(JSON.stringify({ role: "service_role", iss: "supabase" }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "") +
  ".signature-signature-signature";

const PUBLISHABLE = "sb_publishable_aBcDeFgHiJkLmNoPqRsTuV_12345678";
// Deliberately NOT key-shaped (wrong length, hyphens) so secret scanners do
// not flag the test suite; the classifier only checks the prefix.
const SECRET = "sb_secret_fixture-not-a-real-key";

describe("normalizeProjectUrl", () => {
  it("trims whitespace, stray quotes and trailing slashes", () => {
    expect(normalizeProjectUrl("  https://abc.supabase.co/  ")).toBe("https://abc.supabase.co");
    expect(normalizeProjectUrl('"https://abc.supabase.co///"')).toBe("https://abc.supabase.co");
  });

  it("leaves a clean URL alone", () => {
    expect(normalizeProjectUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co");
  });
});

describe("normalizeAnonKey", () => {
  it("removes paste noise without touching the token", () => {
    expect(normalizeAnonKey(`\n  ${LEGACY_ANON} \n`)).toBe(LEGACY_ANON);
    expect(normalizeAnonKey(`"${PUBLISHABLE}"`)).toBe(PUBLISHABLE);
  });
});

describe("inspectApiKey", () => {
  it("recognises the legacy anon JWT and the legacy service_role JWT", () => {
    expect(inspectApiKey(LEGACY_ANON)).toBe("legacy-anon");
    expect(inspectApiKey(LEGACY_SERVICE_ROLE)).toBe("legacy-service-role");
  });

  it("recognises the new publishable / secret prefixes", () => {
    expect(inspectApiKey(PUBLISHABLE)).toBe("publishable");
    expect(inspectApiKey(SECRET)).toBe("secret");
  });

  it("calls anything else unknown rather than guessing", () => {
    expect(inspectApiKey("not-a-key")).toBe("unknown");
  });

  it("decodes a JWT payload and returns null for junk", () => {
    expect(readJwtPayload(LEGACY_ANON)?.role).toBe("anon");
    expect(readJwtPayload("eyJnotbase64.nope")).toBeNull();
  });
});

describe("isLocalhostUrl / hostOf", () => {
  it("treats a local stack as localhost", () => {
    expect(isLocalhostUrl("http://localhost:54321")).toBe(true);
    expect(isLocalhostUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalhostUrl("https://abc.supabase.co")).toBe(false);
    expect(isLocalhostUrl("nonsense")).toBe(false);
  });

  it("reduces a URL to its host for UI labels", () => {
    expect(hostOf("https://abc.supabase.co")).toBe("abc.supabase.co");
    expect(hostOf("http://localhost:54321")).toBe("localhost:54321");
  });
});

describe("validateSupabaseConfig", () => {
  it("accepts an https project URL with either client-key format", () => {
    expect(validateSupabaseConfig("https://abc.supabase.co", LEGACY_ANON)).toBeNull();
    expect(validateSupabaseConfig("https://abc.supabase.co", PUBLISHABLE)).toBeNull();
  });

  it("accepts http only for a local stack", () => {
    expect(validateSupabaseConfig("http://localhost:54321", LEGACY_ANON)).toBeNull();
    expect(validateSupabaseConfig("http://abc.supabase.co", LEGACY_ANON)).toContain("https://");
  });

  it("explains a missing or unparseable URL", () => {
    expect(validateSupabaseConfig("", LEGACY_ANON)).toContain("Project URL");
    expect(validateSupabaseConfig("abc.supabase.co", LEGACY_ANON)).toContain("cannot be parsed");
  });

  it("rejects secret keys, because they bypass RLS", () => {
    expect(validateSupabaseConfig("https://abc.supabase.co", SECRET)).toContain("SECRET");
    expect(validateSupabaseConfig("https://abc.supabase.co", LEGACY_SERVICE_ROLE)).toContain("SECRET");
  });

  it("rejects an obviously wrong key but not an unfamiliar long one", () => {
    expect(validateSupabaseConfig("https://abc.supabase.co", "")).toContain("anon");
    expect(validateSupabaseConfig("https://abc.supabase.co", "sk-ant-123")).toContain("too short");
    // Self-hosted / proxy gateways can issue their own client keys.
    expect(validateSupabaseConfig("https://gw.example.com", "k".repeat(40))).toBeNull();
  });
});
