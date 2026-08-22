import { useRef, useState } from "react";
import { BookOpenCheck, FileText, FileUp, Play, Sparkles, Trash2, Upload } from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import { fmtBytes, timeAgo, toast } from "../components/ui";

export function MaterialsPage({ nav }: { nav: NavFn }) {
  const db = useStore((d) => d);
  const sid = store.studentId;
  const [drag, setDrag] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [topicId, setTopicId] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const materials = db.uploaded_materials.filter((m) => m.student_id === sid);
  const courseTopics = courseId ? db.topics.filter((t) => t.course_id === courseId) : [];

  function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    Array.from(files).forEach((f) => store.uploadMaterial(f, courseId || null, topicId || null));
    toast(`${files.length} file${files.length === 1 ? "" : "s"} uploaded — building study pack`);
  }

  /** Upload pasted/typed notes as a text "document". */
  function saveNotes() {
    if (!notes.trim()) return;
    const blob = new Blob([notes.trim()], { type: "text/plain" });
    const file = new File([blob], "Study notes.txt", { type: "text/plain" });
    store.uploadMaterial(file, courseId || null, topicId || null);
    setNotes(""); setNotesOpen(false);
    toast("Notes turned into study units & questions");
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Study from your materials</span>
          <h1>Materials</h1>
          <p>Upload lecture notes, slides, readings or paste text. StudyLab turns each document into study units, key terms, comprehension &amp; application questions, and review — so you actually learn it, not just see MCQs.</p>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 18, alignItems: "start" }}>
        <div
          className={`dropzone ${drag ? "drag" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp size={36} />
          <h2>Drop a document</h2>
          <p>PDF, Word, PowerPoint, text, markdown or images · readable text (.txt/.md) becomes a full study pack instantly</p>
          <input ref={inputRef} type="file" multiple style={{ display: "none" }}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg"
            onChange={(e) => handleFiles(e.target.files)} />
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>File it & add text</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label>Course (optional)
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setTopicId(""); }}>
                <option value="">Unfiled</option>
                {db.courses.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </label>
            <label>Topic (optional)
              <select value={topicId} onChange={(e) => setTopicId(e.target.value)} disabled={!courseId}>
                <option value="">General course material</option>
                {courseTopics.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <button className="secondary" onClick={() => setNotesOpen((v) => !v)}>
              <Sparkles size={15} /> {notesOpen ? "Hide" : "Paste notes / text to study"}
            </button>
            {notesOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Paste a reading, lecture excerpt or your own notes. StudyLab will split it into units, pull out key terms and write comprehension questions..."
                  style={{ minHeight: 140 }} />
                <button className="primary" onClick={saveNotes} disabled={!notes.trim()}><BookOpenCheck size={15} /> Turn into study pack</button>
              </div>
            )}
            <p className="muted" style={{ fontSize: 12 }}>Each processed document appears as its own topic with units and questions. Open it to study, then practise and review.</p>
          </div>
        </div>
      </div>

      <div className="section-head"><h2>Your materials ({materials.length})</h2></div>
      {materials.length === 0 ? (
        <div className="empty-state"><FileText size={32} /><h2>No materials yet</h2><p>Upload a document or paste notes to build your first study pack.</p></div>
      ) : (
        <div className="list">
          {materials.map((m) => {
            const course = m.course_id ? db.courses.find((c) => c.id === m.course_id) : null;
            const studyTopic = m.topic_id ? db.topics.find((t) => t.id === m.topic_id) : null;
            const ai = m.ai_classification as (Record<string, unknown> | null);
            const qCount = ai?.questions as number | undefined;
            const uCount = ai?.units as number | undefined;
            return (
              <div key={m.id} className="upload-row">
                <div className="ico"><FileText size={18} /></div>
                <div className="meta">
                  <strong>{m.file_name}</strong>
                  <span>{fmtBytes(m.file_size)} · {course?.code ?? "unfiled"} · {timeAgo(m.created_at)}</span>
                  {studyTopic ? (
                    <div className="row" style={{ marginTop: 6 }}>
                      <span className="chip good"><BookOpenCheck size={12} /> Study pack ready</span>
                      <span className="chip brand">{uCount ?? "—"} units</span>
                      <span className="chip brand">{qCount ?? "—"} questions</span>
                      <span className="muted" style={{ fontSize: 11 }}>from your document</span>
                    </div>
                  ) : m.processing_status === "processing" ? (
                    <span className="chip warn" style={{ marginTop: 6 }}>processing…</span>
                  ) : (
                    <span className="chip muted" style={{ marginTop: 6 }}>stored — paste its text to generate study units</span>
                  )}
                </div>
                <span className={`chip ${m.processing_status === "ready" ? "good" : m.processing_status === "failed" ? "bad" : "warn"}`}>{m.processing_status}</span>
                {studyTopic && (
                  <>
                    <button className="secondary small" onClick={() => nav({ name: "ai", topicId: studyTopic.id, courseId: studyTopic.course_id })}>
                      <Sparkles size={13} /> Ask AI
                    </button>
                    <button className="primary small" onClick={() => nav({ name: "course", courseId: studyTopic.course_id })}>
                      <Play size={13} /> Study
                    </button>
                  </>
                )}
                <button className="ghost small danger" onClick={() => store.remove("uploaded_materials", m.id)}><Trash2 size={14} /></button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
