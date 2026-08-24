// Shown when no Supabase backend is configured — neither the build-time
// VITE_SUPABASE_* variables nor a pair saved in this browser.
// Honest unconfigured state — no fake data behind this screen.

import { useState } from "react";
import { Database, KeyRound, Link2, ShieldCheck } from "lucide-react";
import { Button, Card, Field, Spinner } from "../components/ui";
import { saveBrowserConfig } from "../lib/supabase";

export function SetupPage() {
  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SETUP</span>
          <h1>Connect StudyLab to your Supabase project</h1>
          <p>StudyLab needs a Supabase backend for auth, curriculum and progress. Nothing is faked until it is connected.</p>
        </div>
      </div>
      <Card className="setup-card">
        <div className="setup-step">
          <div className="setup-num">1</div>
          <div>
            <h3>Create a Supabase project</h3>
            <p>
              From your project dashboard copy the <code>Project URL</code> and the <code>anon public key</code>
              (Project Settings → API Keys).
            </p>
          </div>
        </div>
        <div className="setup-step">
          <div className="setup-num">2</div>
          <div>
            <h3>Run the database migrations</h3>
            <p>
              Apply <code>supabase/migrations/*.sql</code> in order in the SQL editor (0001 first). This creates the
              curriculum, session, mastery, RLS policies and the private <code>student-materials</code> storage bucket.
            </p>
          </div>
        </div>
        <div className="setup-step">
          <div className="setup-num">3</div>
          <div className="setup-step-body">
            <h3>
              <Link2 size={14} /> Connect this browser
            </h3>
            <p>
              Paste the two values below to start using StudyLab right now. They are stored in this browser only —
              nothing is uploaded anywhere except to your own Supabase project.
            </p>
            <ConnectForm />
            <div className="setup-alt">
              <KeyRound size={14} />
              <p>
                <strong>Deploying instead?</strong> Set <code>VITE_SUPABASE_URL</code> and{" "}
                <code>VITE_SUPABASE_ANON_KEY</code> as build-time environment variables (on Vercel: Project →
                Settings → Environment Variables, then redeploy). Those always take precedence over the pair saved
                here. For local development, copy <code>.env.example</code> to <code>.env</code> and restart the dev
                server.
              </p>
            </div>
          </div>
        </div>
        <div className="setup-step">
          <div className="setup-num">4</div>
          <div>
            <h3>
              <ShieldCheck size={14} /> Optional — deploy the AI Edge Functions
            </h3>
            <p>
              <code>supabase/functions/ai-tutor</code> and <code>process-material</code> work when deployed with an AI
              provider key set as a secret. Until then those features show a clear “pending” state and every other
              feature works fully.
            </p>
          </div>
        </div>
        <div className="setup-note">
          <Database size={16} />
          <p>
            Security: all student data is protected by RLS, uploads go to a private bucket, and AI keys live only in
            Edge Function secrets — never in the browser. The key you paste here is the public client key (legacy{" "}
            <code>eyJ…</code> anon or new <code>sb_publishable_…</code>); a secret key is rejected.
          </p>
        </div>
      </Card>
    </section>
  );
}

function ConnectForm() {
  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function connect() {
    setBusy(true);
    const err = saveBrowserConfig(url, anonKey);
    if (err) {
      setError(err);
      setBusy(false);
      return;
    }
    // The Supabase client is created once at module load, so reload to rebuild it.
    window.location.reload();
  }

  return (
    <div className="setup-form">
      <Field
        label="Project URL"
        value={url}
        onChange={setUrl}
        placeholder="https://your-project.supabase.co"
        spellCheck={false}
      />
      <Field
        label="Anon (publishable) key"
        value={anonKey}
        onChange={setAnonKey}
        placeholder="eyJ… or sb_publishable_…"
        hint="Project Settings → API Keys → anon public. Never the secret key."
        spellCheck={false}
      />
      {error && (
        <div className="error-note" role="alert">
          {error}
        </div>
      )}
      <Button onClick={connect} disabled={busy || !url.trim() || !anonKey.trim()}>
        {busy ? <Spinner label="Connecting…" /> : "Connect StudyLab"}
      </Button>
    </div>
  );
}
