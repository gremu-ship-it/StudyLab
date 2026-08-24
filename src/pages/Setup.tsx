// Shown when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.
// Honest unconfigured state — no fake data behind this screen.

import { Database, ShieldCheck } from "lucide-react";
import { Card } from "../components/ui";

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
              From your project dashboard copy the <code>Project URL</code> and the <code>anon public key</code>.
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
          <div>
            <h3>Configure the environment</h3>
            <p>
              Copy <code>.env.example</code> to <code>.env</code> and set:
            </p>
            <pre className="code">
              {`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}
            </pre>
            <p>Then restart the dev server.</p>
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
            Edge Function secrets — never in the browser.
          </p>
        </div>
      </Card>
    </section>
  );
}
