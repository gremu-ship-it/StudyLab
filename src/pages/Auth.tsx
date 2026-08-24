import { useState } from "react";
import { GraduationCap } from "lucide-react";
import * as api from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button, ErrorNote, Field, Select, Spinner } from "../components/ui";

export function AuthPage() {
  const { state, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    const err =
      mode === "in" ? await signIn(email, password) : await signUp(email, password, name);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand-mark large">
          <GraduationCap size={26} />
        </div>
        <h1>StudyLab</h1>
        <p className="muted">Personalised learning for your degree — learn, practise, master.</p>

        <div className="auth-switch">
          <button className={mode === "in" ? "active" : ""} onClick={() => setMode("in")}>
            Sign in
          </button>
          <button className={mode === "up" ? "active" : ""} onClick={() => setMode("up")}>
            Create account
          </button>
        </div>

        <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@example.com" />
        {mode === "up" && <Field label="Full name" value={name} onChange={setName} placeholder="Your name" />}
        <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 8 characters" />

        {error && <ErrorNote message={error} />}

        <Button full onClick={submit} disabled={busy}>
          {busy ? <Spinner label="One moment…" /> : mode === "in" ? "Sign in" : "Create account"}
        </Button>
      </div>
    </div>
  );
}

export function OnboardingPage() {
  const { state, completeOnboarding } = useAuth();
  const [name, setName] = useState("");
  const [programmeId, setProgrammeId] = useState(state.status === "onboarding" ? state.programme?.id ?? "" : "");
  const [periodId, setPeriodId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state.status !== "onboarding") return null;
  const { user, programmes, periods, programme } = state;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await completeOnboarding({
        id: user.id,
        full_name: name || user.email.split("@")[0],
        programme_id: programmeId || null,
        current_year: programme?.duration_years ? 2 : null,
        current_semester: 1,
      });
      if (periodId) {
        try {
          await api.upsertEnrolment({ student_id: user.id, programme_id: programmeId, academic_period_id: periodId });
        } catch {
          /* enrolment is non-fatal for onboarding */
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="eyebrow">WELCOME TO STUDYLAB</span>
        <h1>Set up your learning profile</h1>
        <p className="muted">This tells the tutor which programme and semester you are in, so guidance stays relevant.</p>
        <Field label="Full name" value={name} onChange={setName} placeholder="Your name" />
        <Select
          label="Programme"
          value={programmeId}
          onChange={setProgrammeId}
          options={programmes.map((p) => ({ value: p.id, label: p.name }))}
        />
        {periods.length > 0 && (
          <Select
            label="Academic period"
            value={periodId}
            onChange={setPeriodId}
            options={periods.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
        {error && <ErrorNote message={error} />}
        <Button full onClick={submit} disabled={busy || !programmeId}>
          {busy ? "Setting up…" : "Start learning"}
        </Button>
      </div>
    </div>
  );
}
