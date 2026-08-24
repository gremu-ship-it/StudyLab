// Course material: private uploads → server-side extraction → structured
// content with provenance. The original file is never modified.

import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, FileText, PlayCircle, Trash2, Upload, Zap } from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import { sourceBanner } from "../lib/sources";
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  Select,
  Spinner,
} from "../components/ui";
import { useRoute } from "../router";
import type { ExtractedItem, UploadedMaterial } from "../types";

const ITEM_LABELS: Record<ExtractedItem["item_type"], string> = {
  heading: "Heading",
  definition: "Definition",
  formula: "Formula",
  example: "Example",
  question: "Question / problem",
  objective: "Learning objective",
  activity: "Practical activity",
  concept: "Concept",
  relationship: "Concept relationship",
};

export function MaterialsPage() {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  const profile = state.status === "ready" ? state.profile : null;
  const route = useRoute();

  const [file, setFile] = useState<File | null>(null);
  const [topicId, setTopicId] = useState(route.query.topic ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const materialsQ = useQuery(api.getMaterials, [user?.id]);
  const coursesQ = useQuery(
    () => (profile?.programme_id ? api.getCourses(profile.programme_id) : Promise.resolve([])),
    [profile?.programme_id],
  );
  const topicsQ = useQuery(async () => {
    const courses = coursesQ.data ?? [];
    return courses.length ? api.getTopicsForCourses(courses.map((c) => c.id)) : [];
  }, [(coursesQ.data ?? []).map((c) => c.id).join(",")]);

  const courseName = (id: string | null) => coursesQ.data?.find((c) => c.id === id)?.name ?? "";
  const topicName = (id: string | null) => topicsQ.data?.find((t) => t.id === id)?.name ?? "";

  async function upload() {
    if (!user || !file) return;
    setBusy(true);
    setError(null);
    try {
      await api.uploadMaterial({
        file,
        student_id: user.id,
        topic_id: topicId || null,
        course_id: topicId ? topicsQ.data?.find((t) => t.id === topicId)?.course_id ?? null : null,
      });
      setFile(null);
      setTopicId("");
      if (inputRef.current) inputRef.current.value = "";
      materialsQ.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SOURCE LEVEL 1 — YOUR COURSE MATERIAL</span>
          <h1>Course material</h1>
          <p>Lecture notes, slides, lab manuals and past papers. Files are stored privately and never modified.</p>
        </div>
      </div>

      <Card className="upload-card">
        <div className="upload-row">
          <Upload size={22} />
          <div>
            <h3>Upload a document</h3>
            <p className="mut small">When a document is uploaded: store original → create processing job → extract text → detect sections, concepts, definitions, formulas, examples, questions, objectives, activities → determine course/topic → build/update knowledge graph → generate learning units/practice/assessment → update path. The document is NOT complete just because it exists in Library — it must contribute active knowledge.</p>
          </div>
        </div>
        <div className="upload-actions">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.png,.jpg"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Choose file…
          </Button>
          <span className="mut small">{file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "No file selected"}</span>
          <Select
            value={topicId}
            onChange={setTopicId}
            options={[
              { value: "", label: "Link to topic (optional)" },
              ...(topicsQ.data ?? []).map((t) => ({
                value: t.id,
                label: `${courseName(t.course_id)} — ${t.name}`,
              })),
            ]}
          />
          <Button onClick={upload} disabled={!file || busy}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
        {error && <ErrorNote message={error} />}
      </Card>

      {materialsQ.loading ? (
        <Spinner label="Loading materials…" />
      ) : (materialsQ.data ?? []).length === 0 ? (
        <Empty
          icon={<FileText size={36} />}
          title="No material uploaded yet"
          body="Upload the notes from your last lecture. StudyLab keeps the original file untouched, extracts its structure server-side, and shows every extracted item with its provenance."
        />
      ) : (
        <div className="material-list">
          {(materialsQ.data ?? []).map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              topicName={topicName(m.topic_id)}
              courseName={courseName(m.course_id)}
              onDelete={async () => {
                try {
                  await api.deleteMaterial(m.id);
                  materialsQ.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : String(e));
                }
              }}
              onProcessed={materialsQ.refresh}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function MaterialRow({
  material,
  topicName,
  courseName,
  onDelete,
  onProcessed,
}: {
  material: UploadedMaterial;
  topicName: string;
  courseName: string;
  onDelete: () => void;
  onProcessed: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const itemsQ = useQuery(
    async () => (open ? api.getExtractedItems(material.id) : []),
    [open, material.id],
  );

  async function process() {
    setProcessing(true);
    setNote(null);
    try {
      const res = await api.requestMaterialProcessing(material.id);
      setNote(res.ok ? `Processed: ${res.message || "extracted content ready"}` : `Processing pending — ${res.message}`);
      onProcessed();
    } catch (e) {
      setNote(`Processing failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Card className="material-card">
      <div className="material-head" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <FileText size={18} />
        <div className="material-main">
          <h3>{material.file_name}</h3>
          <span className="mut small">
            {courseName && `${courseName} · `}
            {topicName ? `Topic: ${topicName}` : "No topic linked"} · {new Date(material.created_at).toLocaleDateString("en-GB")}
          </span>
        </div>
        <span className={`status-pill ${material.processing_status}`}>{material.processing_status}</span>
        <Button variant="ghost" onClick={process} title="Run server-side extraction">
          <Zap size={14} /> {processing ? "Processing…" : "Process"}
        </Button>
        <Button variant="ghost" onClick={onDelete} title="Delete material">
          <Trash2 size={14} />
        </Button>
      </div>
      {material.processing_error && <p className="error-text">{material.processing_error}</p>}
      {note && <p className="mut small">{note}</p>}
      {open &&
        (itemsQ.loading ? (
          <Spinner label="Loading extracted content…" />
        ) : (itemsQ.data ?? []).length === 0 ? (
          <p className="muted">
            No extracted content yet. Run “Process” to extract structure server-side (text/markdown is supported now;
            PDF extraction is pending — the pipeline is in place, the parser is not yet deployed).
          </p>
        ) : (
          <div className="extract-list">
            {(itemsQ.data ?? []).map((it) => (
              <div key={it.id} className="extract-item">
                <span className={`extract-type t-${it.item_type}`}>{ITEM_LABELS[it.item_type]}</span>
                <div>
                  {it.heading && <span className="eyebrow">{it.heading}</span>}
                  <p>{it.content}</p>
                  {it.source_page != null && <small className="mut">page {it.source_page} · confidence {Math.round(it.confidence * 100)}%</small>}
                </div>
                <span className="source-badge s1" title={sourceBanner(1)}>
                  From your upload
                </span>
              </div>
            ))}
          </div>
        ))}
    </Card>
  );
}
