import { useState } from "react";
import { CheckCircle2, ChevronRight, PlayCircle, Plus, Target } from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import { dayLabel } from "../components/ui";
import { Modal, toast } from "../components/ui";

export function StudyPlanPage({ nav }: { nav: NavFn }) {
  const db = useStore((d) => d);
  const sid = store.studentId;
  const [showAdd, setShowAdd] = useState(false);
  const plan = db.study_plans.find((p) => p.student_id === sid && p.status === "active") ?? db.study_plans[0];
  const items = db.study_plan_items.filter((i) => i.study_plan_id === plan?.id).sort((a, b) => a.sequence_number - b.sequence_number);
  const sessions = db.study_sessions.slice(0, 6);

  const completed = items.filter((i) => i.status === "completed").length;
  const totalMin = items.reduce((s, i) => s + i.planned_minutes, 0);
  const doneMin = items.filter((i) => i.status === "completed").reduce((s, i) => s + i.planned_minutes, 0);

  function startSession() {
    const nextTopic = items.find((i) => i.status !== "completed")?.topic_id ?? null;
    const id = store.startSession("recommended", nextTopic, "Daily adaptive plan");
    toast("Study session started");
    setTimeout(() => store.endSession(id), 1500); // auto-close for demo; real sessions end on exit
    nav({ name: nextTopic ? "practice" : "study", topicId: nextTopic ?? undefined });
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Personalised adaptive plan</span>
          <h1>Today's Study Plan</h1>
          <p>{dayLabel(plan?.start_date ?? new Date().toISOString())} · {totalMin} minutes · {completed}/{items.length} blocks complete</p>
        </div>
        <div className="row">
          <button className="secondary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add block</button>
          <button className="primary" onClick={startSession}><PlayCircle size={16} /> Start session</button>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="stat-icon"><Target size={20} /></div><div><span>Planned today</span><strong>{totalMin} min</strong><small>{doneMin} completed</small></div></div>
        <div className="stat"><div className="stat-icon"><CheckCircle2 size={20} /></div><div><span>Completion</span><strong>{items.length ? Math.round((completed / items.length) * 100) : 0}%</strong><small>{completed} of {items.length} blocks</small></div></div>
        <div className="stat"><div className="stat-icon"><PlayCircle size={20} /></div><div><span>Sessions logged</span><strong>{sessions.length}</strong><small>all-time</small></div></div>
      </div>

      <div className="panel">
        <div className="timeline">
          {items.map((item) => {
            const topic = db.topics.find((t) => t.id === item.topic_id);
            const course = topic ? db.courses.find((c) => c.id === topic.course_id) : null;
            return (
              <div key={item.id} className={`timeline-item ${item.status === "completed" ? "done" : ""}`}>
                <div className="time">{item.planned_minutes} min</div>
                <button className="dot" onClick={() => store.togglePlanItem(item.id)} style={{ border: "none", cursor: "pointer" }}>
                  {item.status === "completed" ? <CheckCircle2 size={16} /> : item.sequence_number}
                </button>
                <div className="timeline-content">
                  <span>{course?.code ?? "StudyLab"}</span>
                  <h3>{item.title}</h3>
                  <p>{topic?.name ?? "General study activity"}</p>
                </div>
                {item.status !== "completed" && topic && (
                  <button className="ghost small" onClick={() => nav({ name: "course", courseId: topic.course_id })}>Open <ChevronRight size={14} /></button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="section-head"><div><h2>Recent sessions</h2><p>Your recent study activity</p></div></div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Type</th><th>Topic</th><th>Duration</th><th>Note</th></tr></thead>
            <tbody>
              {sessions.map((s) => {
                const topic = db.topics.find((t) => t.id === s.topic_id);
                return (
                  <tr key={s.id}>
                    <td>{new Date(s.started_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td>
                    <td><span className="chip brand">{s.session_type.replace("_", " ")}</span></td>
                    <td>{topic?.name ?? "—"}</td>
                    <td>{s.duration_seconds ? `${Math.round(s.duration_seconds / 60)} min` : "in progress"}</td>
                    <td className="muted">{s.note ?? "—"}</td>
                  </tr>
                );
              })}
              {!sessions.length && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-mute)" }}>No sessions yet — start your first above.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <AddBlockModal open={showAdd} onClose={() => setShowAdd(false)} planId={plan?.id ?? ""} topics={db.topics.map((t) => ({ id: t.id, name: t.name, course: db.courses.find((c) => c.id === t.course_id)?.name ?? "" }))} />
    </section>
  );
}

function AddBlockModal({ open, onClose, planId, topics }: { open: boolean; onClose: () => void; planId: string; topics: { id: string; name: string; course: string }[] }) {
  const [title, setTitle] = useState("");
  const [topicId, setTopicId] = useState("");
  const [mins, setMins] = useState(15);
  return (
    <Modal open={open} onClose={onClose} title="Add a study block" eyebrow="Study plan">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label>Title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Revise limits" /></label>
        <label>Linked topic
          <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">General / no specific topic</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.course}</option>)}
          </select>
        </label>
        <label>Minutes<input type="number" min={1} max={180} value={mins} onChange={(e) => setMins(Number(e.target.value))} /></label>
      </div>
      <div className="modal-actions">
        <button className="secondary" onClick={onClose}>Cancel</button>
        <button className="primary" onClick={() => {
          if (!title.trim()) return;
          const db = store.get();
          const seq = db.study_plan_items.filter((i) => i.study_plan_id === planId).length + 1;
          store.insert("study_plan_items", {
            id: `spi-${Date.now()}`, study_plan_id: planId, topic_id: topicId || null, title: title.trim(),
            scheduled_date: new Date().toISOString().slice(0, 10), planned_minutes: mins, sequence_number: seq, status: "planned",
          });
          setTitle(""); setTopicId(""); setMins(15); onClose(); toast("Block added to plan");
        }}>Add block</button>
      </div>
    </Modal>
  );
}
