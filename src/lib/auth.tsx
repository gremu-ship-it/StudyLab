// Auth + student onboarding context.
// States:
//   unconfigured — VITE_SUPABASE_* missing → app shows the setup page
//   loading      — resolving session
//   auth         — signed out (show sign in/up)
//   onboarding   — signed in, no profile yet (pick programme/period)
//   ready        — signed in with profile + enrolment

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import * as api from "./api";
import type { AcademicPeriod, Programme, StudentProfile, User as AppUser } from "../types";

export type AuthState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "onboarding"; user: AppUser; programmes: Programme[]; periods: AcademicPeriod[]; programme: Programme | null }
  | { status: "ready"; user: AppUser; profile: StudentProfile };

interface AuthContextValue {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  completeOnboarding: (profile: Partial<StudentProfile> & { id: string }) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    if (!supabase) {
      setState({ status: "unconfigured" });
      return;
    }
    const { data: session } = await supabase.auth.getSession();
    const user = session?.session?.user;
    if (!user) {
      setState({ status: "signed_out" });
      return;
    }
    const appUser: AppUser = { id: user.id, email: user.email ?? "" };
    try {
      const [profile, programmes] = await Promise.all([api.getProfile(), api.getProgrammes()]);
      if (!profile) {
        const first = programmes[0] ?? null;
        const periods = first ? await api.getPeriods(first.id) : [];
        setState({ status: "onboarding", user: appUser, programmes, periods, programme: first });
        return;
      }
      setState({ status: "ready", user: appUser, profile });
    } catch {
      setState({ status: "signed_out" });
    }
  }, []);

  useEffect(() => {
    refresh();
    if (supabase) {
      const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) refresh();
      });
      return () => sub.subscription.unsubscribe();
    }
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return "Supabase is not configured";
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    await refresh();
    return null;
  }, [refresh]);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      if (!supabase) return "Supabase is not configured";
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      if (error) return error.message;
      // Auto-create the profile row so onboarding is one step.
      if (data.user) {
        try {
          await api.upsertProfile({ id: data.user.id, full_name: fullName });
        } catch {
          /* onboarding screen will create it if this failed */
        }
      }
      await refresh();
      return null;
    },
    [refresh],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setState({ status: "signed_out" });
  }, []);

  const completeOnboarding = useCallback(
    async (profile: Partial<StudentProfile> & { id: string }) => {
      await api.upsertProfile(profile);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ state, signIn, signUp, signOut, completeOnboarding, refresh }),
    [state, signIn, signUp, signOut, completeOnboarding, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Convenience: current user id (only meaningful when ready). */
export function useUserId(): string | null {
  const { state } = useAuth();
  return state.status === "ready" ? state.user.id : null;
}

/** Small data-fetching hook with retry. */
export function useQuery<T>(fn: () => PromiseLike<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    Promise.resolve(fn())
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const mutate = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, refresh: mutate, setData };
}
