import { useState } from "react";
import { Check, ClipboardList, Plus, Sparkles, Upload } from "lucide-react";
import { useStore, store } from "../store";
import { useStudent } from "../student";
import type { NavFn } from "../App";
import { Modal, toast } from "../components/ui";

export function InboxPage({ nav }: { nav: NavFn }) {
  const db = useStore((d) => d);
  const ctx = useStudent();
  const [showAdd, setShowAdd] = useState(false);
  const [courseId, setCourseId] = useState(ctx.courses[0]?.id ?? "");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const inbox = db.topics.filter((t) => t.status === "student_added" && ctx.courseIds.has(t.course_id));
  const confirmed = db.topics.filter((t) => t.status === "confirmed" && ctx.courseIds.has(t.course_id));

  function submit() {
    if (!name.trim() || !courseId) return;
    store.addTopic(courseId, name.trim(), desc.trim());
    setName(""); setDesc(""); setShowAdd(false);
    toast("Topic added to curriculum inbox");
  }

  function confirmTopic(id: string) {
    store.update("topics", id, { status: "confirmed" });
    toast("Topic confirmed into curriculum");
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Curriculum inbox</span>
          <h1>What's new?</h1>
          <p>Topics you add are reviewed privately before joining your active curriculum. The AI uses them to build learning, practice and review.</p>
        </div>
        <div className="row">
          <button className="secondary" onClick={() => nav({ name: "materials" })}><Upload size={16} /> Upload material</button>
          <button className="primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add topic</button>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h3><ClipboardList size={16} style={{ display: "inline", verticalAlign: "-2px", color: "var(--warn)" }} /> Pending ({inbox.length})</h3><span className="chip warn">student-added</span></div>
          {inbox.length === 0 ? (
            <div className="empty-state" style={{ padding: 30, border: "none", background: "transparent" }}>
              <Sparkles size={28} />
              <h2 style={{ fontSize: 16 }}>Inbox clear</h2>
              <p style={{ fontSize: 13 }}>Topics your lecturer introduces today can be added here.</p>
            </div>
          ) : (
            <div className="list">
              {inbox.map((t) => {
                const course = db.courses.find((c) => c.id === t.course_id);
                return (
                  <div key={t.id} className="list-item">
                    <div className="grow">
                      <h3>{t.name}</h3>
                      <p>{course?.code} · {course?.name}{t.description ? ` — ${t.description}` : ""}</p>
                    </div>
                    <button className="secondary small" onClick={() => nav({ name: "course", courseId: t.course_id })}>Open</button>
                    <button className="primary small" onClick={() => confirmTopic(t.id)}><Check size={14} /> Confirm</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h3><Check size={16} style={{ display: "inline", verticalAlign: "-2px", color: "var(--good)" }} /> In curriculum ({confirmed.length})</h3></div>
          <div className="list" style={{ maxHeight: 420, overflowY: "auto" }}>
            {confirmed.map((t) => {
              const course = db.courses.find((c) => c.id === t.course_id);
              return (
                <button key={t.id} className="list-item clickable" onClick={() => nav({ name: "course", courseId: t.course_id })}>
                  <div className="grow">
                    <h3>{t.name}</h3>
                    <p>{course?.code} · {course?.name}</p>
                  </div>
                  <span className="chip good">{t.status}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} eyebrow="Curriculum inbox" title="Add a new topic"
        footer={<>
          <button className="secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          <button className="primary" onClick={submit}><Plus size={16} /> Add to inbox</button>
        </>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label>Course
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {ctx.courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
            </select>
          </label>
          <label>Topic name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Integration by parts" /></label>
          <label>Context (optional)<textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What did the lecturer cover? What feels tricky?" /></label>
          <p className="muted" style={{ fontSize: 12 }}>💡 Tip: also upload lecture slides from the Materials tab — the AI can extract topics and build learning units.</p>
        </div>
      </Modal>
    </section>
  );
}
