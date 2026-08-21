import { useRef, useState } from "react";
import { FileText, FileUp, Sparkles, Trash2, Upload } from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import { fmtBytes, timeAgo, toast } from "../components/ui";

export function MaterialsPage({ nav }: { nav: NavFn }) {
  const db = useStore((d) => d);
  const sid = store.studentId;
  const [drag, setDrag] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [topicId, setTopicId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const materials = db.uploaded_materials.filter((m) => m.student_id === sid);
  const courseTopics = courseId ? db.topics.filter((t) => t.course_id === courseId) : [];

  function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    Array.from(files).forEach((f) =>
      store.uploadMaterial(f, courseId || null, topicId || null)
    );
    toast(`${files.length} file${files.length === 1 ? "" : "s"} uploaded · processing`);
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Private storage</span>
          <h1>Uploaded materials</h1>
          <p>Upload lecture notes, slides or PDFs. StudyLab extracts text, classifies the topic and feeds the AI tutor.</p>
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
          <h2>Drop files here</h2>
          <p>or click to browse · PDF, Word, PowerPoint, text and images</p>
          <input
            ref={inputRef} type="file" multiple style={{ display: "none" }}
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>File the upload</h3>
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
            <p className="muted" style={{ fontSize: 12 }}>Uploads are private to your account (RLS-protected in Supabase). The AI reads extracted text only when you start a conversation in "material analysis" mode.</p>
            <button className="primary" onClick={() => inputRef.current?.click()}><Upload size={16} /> Choose files</button>
          </div>
        </div>
      </div>

      <div className="section-head"><h2>Your library ({materials.length})</h2></div>
      {materials.length === 0 ? (
        <div className="empty-state"><FileText size={32} /><h2>No materials yet</h2><p>Your first upload will appear here once processed.</p></div>
      ) : (
        <div className="list">
          {materials.map((m) => {
            const course = m.course_id ? db.courses.find((c) => c.id === m.course_id) : null;
            const topic = m.topic_id ? db.topics.find((t) => t.id === m.topic_id) : null;
            return (
              <div key={m.id} className="upload-row">
                <div className="ico"><FileText size={18} /></div>
                <div className="meta">
                  <strong>{m.file_name}</strong>
                  <span>{fmtBytes(m.file_size)} · {course?.code ?? "unfiled"}{topic ? ` · ${topic.name}` : ""} · {timeAgo(m.created_at)}</span>
                  {m.ai_classification && (
                    <div className="row" style={{ marginTop: 6 }}>
                      <Sparkles size={12} style={{ color: "var(--brand)" }} />
                      <span className="muted" style={{ fontSize: 11 }}>Suggested: {String((m.ai_classification as Record<string, unknown>).suggested_topic ?? "")}</span>
                    </div>
                  )}
                </div>
                <span className={`chip ${m.processing_status === "ready" ? "good" : m.processing_status === "failed" ? "bad" : "warn"}`}>{m.processing_status}</span>
                {m.processing_status === "ready" && (
                  <button className="secondary small" onClick={() => nav({ name: "ai", courseId: m.course_id ?? undefined, topicId: m.topic_id ?? undefined })}>
                    <Sparkles size={13} /> Ask AI
                  </button>
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
