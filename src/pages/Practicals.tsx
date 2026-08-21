import { useState } from "react";
import { ChevronRight, FlaskConical, ShieldAlert } from "lucide-react";
import { useStore } from "../store";
import type { NavFn } from "../App";
import { Modal } from "../components/ui";

export function PracticalListPage({ nav }: { nav: NavFn }) {
  const db = useStore((d) => d);
  const [open, setOpen] = useState<string | null>(null);

  const practicals = db.practicals.map((p) => {
    const topic = db.topics.find((t) => t.id === p.topic_id)!;
    const course = db.courses.find((c) => c.id === topic.course_id)!;
    const steps = db.practical_steps.filter((s) => s.practical_id === p.id).sort((a, b) => a.step_number - b.step_number);
    return { p, topic, course, steps };
  });

  const active = practicals.find((x) => x.p.id === open);

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Hands-on learning</span>
          <h1>Practicals</h1>
          <p>{practicals.length} guided lab activities with procedures, safety notes and assessment.</p>
        </div>
      </div>

      <div className="course-grid">
        {practicals.map(({ p, topic, course, steps }) => (
          <button key={p.id} className="course-card" onClick={() => setOpen(p.id)}>
            <div className="course-icon" style={{ background: "linear-gradient(135deg, var(--accent), #0891b2)" }}><FlaskConical size={19} /></div>
            <div className="course-main">
              <span>{course.code} · {steps.length} steps</span>
              <h3>{p.title}</h3>
              <small>{topic.name}</small>
            </div>
            <ChevronRight size={18} className="arrow" />
            <p style={{ fontSize: 12, marginTop: 8 }}>{p.objective}</p>
          </button>
        ))}
      </div>

      <Modal open={!!open} onClose={() => setOpen(null)} size="lg" title={active?.p.title} eyebrow={`${active?.course.code} · ${active?.topic.name}`}>
        {active && (
          <div>
            <p style={{ marginBottom: 12 }}><strong style={{ color: "var(--text)" }}>Objective:</strong> {active.p.objective}</p>
            {active.p.background && <p style={{ marginBottom: 12 }}>{active.p.background}</p>}
            {active.p.safety_notes && (
              <div className="notice" style={{ background: "rgba(248,113,113,.1)", borderColor: "rgba(248,113,113,.3)" }}>
                <ShieldAlert size={18} style={{ color: "var(--bad)" }} />
                <div><strong>Safety</strong><p>{active.p.safety_notes}</p></div>
              </div>
            )}
            {active.p.materials && active.p.materials.length > 0 && (
              <div style={{ margin: "14px 0" }}>
                <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--brand)", marginBottom: 6 }}>Materials</h4>
                <div className="row">{active.p.materials.map((m, i) => <span key={i} className="chip muted">{m}</span>)}</div>
              </div>
            )}
            <h4 style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 1, color: "var(--brand)", margin: "16px 0 8px" }}>Procedure</h4>
            <div>
              {active.steps.map((s) => (
                <div key={s.id} className="step"><div className="n">{s.step_number}</div><div><p>{s.instruction}</p>{s.observation_prompt && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>📝 {s.observation_prompt}</p>}</div></div>
              ))}
            </div>
            {active.p.expected_outcome && <p style={{ marginTop: 14 }}><strong style={{ color: "var(--text)" }}>Expected outcome:</strong> {active.p.expected_outcome}</p>}
            {active.p.assessment_notes && <p style={{ marginTop: 8 }}><strong style={{ color: "var(--text)" }}>Assessment:</strong> {active.p.assessment_notes}</p>}
            <div className="modal-actions">
              <button className="secondary" onClick={() => setOpen(null)}>Close</button>
              <button className="primary" onClick={() => { setOpen(null); nav({ name: "course", courseId: active.course.id }); }}>Open course</button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
