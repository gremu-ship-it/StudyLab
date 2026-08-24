import { useState } from "react";
import { Building2, CalendarClock, GraduationCap, RotateCcw, Save, Target } from "lucide-react";
import { useStore, store } from "../store";
import { useStudent } from "../student";
import type { NavFn } from "../App";
import { Modal, initials, toast } from "../components/ui";
import { SetupModal } from "../components/SetupModal";

export function ProfilePage({ nav: _nav }: { nav: NavFn }) {
  const db = useStore((d) => d);
  const student = db.student_profiles[0];
  const ctx = useStudent();
  const [switcher, setSwitcher] = useState(false);
  const institution = db.institutions.find((i) => i.id === student.institution_id);
  const programme = db.programmes.find((p) => p.id === student.programme_id);
  const period = db.academic_periods.find((p) => p.programme_id === student.programme_id && p.status === "active");

  const [name, setName] = useState(student.full_name);
  const [year, setYear] = useState(student.current_year);
  const [semester, setSemester] = useState(student.current_semester);
  const [target, setTarget] = useState(Number((student.study_preferences as { daily_target_minutes?: number }).daily_target_minutes ?? 60));
  const [confirmReset, setConfirmReset] = useState(false);

  function save() {
    store.update("student_profiles", student.id, {
      full_name: name, current_year: year, current_semester: semester,
      study_preferences: { ...student.study_preferences, daily_target_minutes: target },
    });
    toast("Profile saved");
  }

  const counts = {
    sessions: db.study_sessions.length,
    attempts: db.question_attempts.length,
    materials: db.uploaded_materials.length,
    conversations: db.ai_conversations.length,
  };

  return (
    <section className="page" style={{ maxWidth: 920 }}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Account</span>
          <h1>Your profile</h1>
          <p>Your learning context and preferences. In production this is backed by Supabase Auth and row-level security.</p>
        </div>
      </div>

      <div className="panel">
        <div className="spread" style={{ flexWrap: "wrap" }}>
          <div className="row">
            <div className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>{initials(name)}</div>
            <div>
              <h2 style={{ fontSize: 22 }}>{name}</h2>
              <p>{programme?.name} · {period?.name}</p>
              <p style={{ marginTop: 2 }}>{institution?.name} · {institution?.country}</p>
            </div>
          </div>
          <div className="row">
            <span className="chip brand"><CalendarClock size={12} /> {student.timezone}</span>
            <button className="secondary small" onClick={() => setSwitcher(true)}><Building2 size={13} /> Switch institution</button>
          </div>
        </div>
      </div>

      <div className="stats" style={{ margin: "18px 0" }}>
        <div className="stat"><div className="stat-icon"><Target size={20} /></div><div><span>Study sessions</span><strong>{counts.sessions}</strong><small>all-time</small></div></div>
        <div className="stat"><div className="stat-icon"><GraduationCap size={20} /></div><div><span>Question attempts</span><strong>{counts.attempts}</strong><small>graded answers</small></div></div>
        <div className="stat"><div className="stat-icon"><Target size={20} /></div><div><span>Materials</span><strong>{counts.materials}</strong><small>uploaded files</small></div></div>
        <div className="stat"><div className="stat-icon"><Target size={20} /></div><div><span>AI chats</span><strong>{counts.conversations}</strong><small>conversations</small></div></div>
      </div>

      <div className="panel">
        <h3 style={{ marginBottom: 14 }}>Edit profile</h3>
        <div className="form-grid">
          <label>Full name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>Institution<input value={institution?.name ?? ""} disabled /></label>
          <label>Programme<input value={programme?.name ?? ""} disabled /></label>
          <label>Daily target (minutes)<input type="number" min={10} max={300} value={target} onChange={(e) => setTarget(Number(e.target.value))} /></label>
          <label>Current year<input type="number" min={1} max={6} value={year} onChange={(e) => setYear(Number(e.target.value))} /></label>
          <label>Current semester<select value={semester} onChange={(e) => setSemester(Number(e.target.value))}><option value={1}>Semester 1</option><option value={2}>Semester 2</option></select></label>
        </div>
        <div className="row" style={{ marginTop: 16, justifyContent: "space-between" }}>
          <button className="ghost danger" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset all demo data</button>
          <button className="primary" onClick={save}><Save size={16} /> Save changes</button>
        </div>
      </div>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)} title="Reset all data?" eyebrow="Danger zone">
        <p>This clears your progress, uploads, conversations and student-added topics, then restores the original seed. This cannot be undone in the demo.</p>
        <div className="modal-actions">
          <button className="secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="primary" style={{ background: "linear-gradient(135deg, var(--bad), #be123c)" }} onClick={() => { store.reset(); setConfirmReset(false); toast("Demo data reset"); }}>Reset everything</button>
        </div>
      </Modal>

      <SetupModal open={switcher} mode="switch" onClose={() => setSwitcher(false)} />
    </section>
  );
}
