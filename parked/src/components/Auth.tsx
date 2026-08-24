import { useState } from "react";
import { GraduationCap, LogIn, Mail, Sparkles } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { signIn, signInWithMagicLink, signUp } from "../lib/live";
import { toast } from "./ui";

export function AuthScreen({ onContinueDemo }: { onContinueDemo: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password, name);
      toast(mode === "signin" ? "Welcome back!" : "Account created — check your email to confirm.");
    } catch (err) {
      toast((err as Error).message || "Sign in failed", "info");
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await signInWithMagicLink(email);
      setMagicSent(true);
      toast("Magic link sent — check your inbox");
    } catch (err) {
      toast((err as Error).message, "info");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div className="panel" style={{ width: "100%", maxWidth: 420, padding: 28 }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div className="brand-mark" style={{ margin: "0 auto 14px", width: 52, height: 52, borderRadius: 14 }}>
            <GraduationCap size={26} />
          </div>
          <h1 style={{ fontSize: 24 }}>Welcome to StudyLab</h1>
          <p className="muted" style={{ marginTop: 4 }}>Sign in to sync your progress across devices, or explore the demo.</p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="notice" style={{ flexDirection: "column", textAlign: "center", gap: 8 }}>
            <Sparkles size={20} />
            <div>
              <strong>Supabase isn't connected yet</strong>
              <p style={{ fontSize: 12, marginTop: 4 }}>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env</code> to enable live sign-in. You can still explore the full demo below.</p>
            </div>
            <button className="primary full" style={{ marginTop: 6 }} onClick={onContinueDemo}><LogIn size={16} /> Continue in demo mode</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {mode === "signup" && (
              <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" /></label>
            )}
            <label>Email
              <div className="search" style={{ maxWidth: "none", background: "var(--bg-2)" }}>
                <Mail size={15} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@university.edu" style={{ background: "transparent", border: "none" }} />
              </div>
            </label>
            <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="At least 6 characters" /></label>

            <button className="primary" disabled={busy} type="submit">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="secondary small" style={{ flex: 1, justifyContent: "center" }} onClick={magicLink} disabled={busy}>
                {magicSent ? "Link sent ✓" : "Email magic link"}
              </button>
              <button type="button" className="ghost small" style={{ flex: 1, justifyContent: "center" }} onClick={onContinueDemo}>Demo mode</button>
            </div>

            <p className="muted" style={{ textAlign: "center", fontSize: 12, marginTop: 4 }}>
              {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
              <button type="button" className="text-btn" style={{ padding: 0, fontSize: 12 }} onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Create an account" : "Sign in"}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
