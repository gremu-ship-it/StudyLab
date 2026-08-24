// Exercises the real connection wiring in src/lib/supabase.ts — which source
// wins, that a stale/invalid stored pair is ignored, and that saving/clearing
// the browser pair does what the Setup screen promises.
//
// No jsdom here: a minimal localStorage + window stub is enough, because the
// module under test only touches window.localStorage.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const LEGACY_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  Buffer.from(JSON.stringify({ role: "anon", iss: "supabase" })).toString("base64url") +
  ".signature-signature-signature";
// Deliberately NOT key-shaped (wrong length, hyphens) so secret scanners do
// not flag the test suite; the classifier only checks the prefix.
const SECRET = "sb_secret_fixture-not-a-real-key";

const store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
};

async function loadSupabase() {
  return await import("../src/lib/supabase");
}

beforeEach(() => {
  store.clear();
  vi.resetModules();
  vi.stubGlobal("window", { localStorage: localStorageStub });
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("connection source", () => {
  it("is unconfigured with neither env vars nor a stored pair", async () => {
    const mod = await loadSupabase();
    expect(mod.activeConfig).toBeNull();
    expect(mod.isSupabaseConfigured).toBe(false);
    expect(mod.supabase).toBeNull();
    expect(mod.connectionLabel()).toBeNull();
  });

  it("uses a valid pair saved by the Setup screen", async () => {
    store.set("studylab.supabase.url", "https://abc.supabase.co");
    store.set("studylab.supabase.anonKey", LEGACY_ANON);
    const mod = await loadSupabase();
    expect(mod.activeConfig).toEqual({
      url: "https://abc.supabase.co",
      anonKey: LEGACY_ANON,
      source: "browser",
    });
    expect(mod.supabase).not.toBeNull();
    expect(mod.connectionLabel()).toBe("this browser → abc.supabase.co");
  });

  it("ignores a stored pair that would not be accepted today", async () => {
    store.set("studylab.supabase.url", "https://abc.supabase.co");
    store.set("studylab.supabase.anonKey", SECRET); // secret key: must never connect
    const mod = await loadSupabase();
    expect(mod.activeConfig).toBeNull();
    expect(mod.supabase).toBeNull();
  });

  it("lets build-time env vars win over a stored pair", async () => {
    store.set("studylab.supabase.url", "https://browser-project.supabase.co");
    store.set("studylab.supabase.anonKey", LEGACY_ANON);
    vi.stubEnv("VITE_SUPABASE_URL", "https://env-project.supabase.co/");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", LEGACY_ANON);
    const mod = await loadSupabase();
    expect(mod.activeConfig?.source).toBe("env");
    expect(mod.activeConfig?.url).toBe("https://env-project.supabase.co"); // trailing slash normalised
    expect(mod.connectionLabel()).toBe("build-time env vars → env-project.supabase.co");
  });

  it("falls back to the stored pair when the env vars are only half-set", async () => {
    store.set("studylab.supabase.url", "https://browser-project.supabase.co");
    store.set("studylab.supabase.anonKey", LEGACY_ANON);
    vi.stubEnv("VITE_SUPABASE_URL", "https://env-project.supabase.co");
    const mod = await loadSupabase();
    expect(mod.activeConfig?.source).toBe("browser");
  });
});

describe("saveBrowserConfig / clearBrowserConfig", () => {
  it("refuses a secret key and stores nothing", async () => {
    const { saveBrowserConfig } = await loadSupabase();
    const error = saveBrowserConfig("https://abc.supabase.co", SECRET);
    expect(error).toContain("SECRET");
    expect(store.size).toBe(0);
  });

  it("normalises what it stores", async () => {
    const { saveBrowserConfig } = await loadSupabase();
    expect(saveBrowserConfig("  https://abc.supabase.co//  ", `\n${LEGACY_ANON}\n`)).toBeNull();
    expect(store.get("studylab.supabase.url")).toBe("https://abc.supabase.co");
    expect(store.get("studylab.supabase.anonKey")).toBe(LEGACY_ANON);
  });

  it("clears the browser pair without touching anything else", async () => {
    const { saveBrowserConfig, clearBrowserConfig } = await loadSupabase();
    saveBrowserConfig("https://abc.supabase.co", LEGACY_ANON);
    expect(store.size).toBe(2);
    clearBrowserConfig();
    expect(store.size).toBe(0);
  });
});
