import { useMemo, useState } from "react";
import { Database, Search, Table2 } from "lucide-react";
import { useStore } from "../store";

type TableKey = keyof import("../types").Database;

const TABLES: { key: TableKey; label: string; group: string; describe: (row: Record<string, unknown>) => string }[] = [
  { key: "institutions", label: "institutions", group: "Curriculum", describe: (r) => String(r.name ?? "") },
  { key: "programmes", label: "programmes", group: "Curriculum", describe: (r) => String(r.name ?? "") },
  { key: "academic_periods", label: "academic_periods", group: "Curriculum", describe: (r) => String(r.name ?? "") },
  { key: "courses", label: "courses", group: "Curriculum", describe: (r) => `${r.code as string} — ${r.name as string}` },
  { key: "course_offerings", label: "course_offerings", group: "Curriculum", describe: (r) => String(r.lecturer_name ?? r.status ?? "") },
  { key: "topics", label: "topics", group: "Curriculum", describe: (r) => String(r.name ?? "") },
  { key: "subtopics", label: "subtopics", group: "Curriculum", describe: (r) => String(r.name ?? "") },
  { key: "skills", label: "skills", group: "Curriculum", describe: (r) => String(r.name ?? "") },
  { key: "topic_skills", label: "topic_skills", group: "Curriculum", describe: () => "mapping" },
  { key: "learning_units", label: "learning_units", group: "Content", describe: (r) => String(r.title ?? "") },
  { key: "content_resources", label: "content_resources", group: "Content", describe: (r) => String(r.title ?? "") },
  { key: "topic_resources", label: "topic_resources", group: "Content", describe: () => "mapping" },
  { key: "questions", label: "questions", group: "Content", describe: (r) => String(r.question_text ?? "").slice(0, 60) },
  { key: "question_options", label: "question_options", group: "Content", describe: (r) => String(r.option_text ?? "") },
  { key: "practicals", label: "practicals", group: "Content", describe: (r) => String(r.title ?? "") },
  { key: "practical_steps", label: "practical_steps", group: "Content", describe: (r) => String(r.instruction ?? "").slice(0, 60) },
  { key: "student_profiles", label: "student_profiles", group: "Student", describe: (r) => String(r.full_name ?? "") },
  { key: "enrolments", label: "enrolments", group: "Student", describe: (r) => String(r.status ?? "") },
  { key: "student_course_enrolments", label: "student_course_enrolments", group: "Student", describe: (r) => String(r.status ?? "") },
  { key: "study_sessions", label: "study_sessions", group: "Progress", describe: (r) => `${r.session_type as string} · ${r.duration_seconds ? Math.round(Number(r.duration_seconds) / 60) + "m" : "active"}` },
  { key: "learning_attempts", label: "learning_attempts", group: "Progress", describe: (r) => `${r.completion_percent as number}% complete` },
  { key: "question_attempts", label: "question_attempts", group: "Progress", describe: (r) => r.is_correct ? "correct" : "incorrect" },
  { key: "topic_mastery", label: "topic_mastery", group: "Progress", describe: (r) => `${r.mastery_score as number}% · ${r.mastery_level as string}` },
  { key: "skill_mastery", label: "skill_mastery", group: "Progress", describe: (r) => `${r.mastery_score as number}%` },
  { key: "review_schedule", label: "review_schedule", group: "Adaptive", describe: (r) => `${r.status as string} · ${r.interval_days as number}d` },
  { key: "recommendations", label: "recommendations", group: "Adaptive", describe: (r) => String(r.reason ?? "").slice(0, 60) },
  { key: "study_plans", label: "study_plans", group: "Adaptive", describe: (r) => String(r.name ?? "") },
  { key: "study_plan_items", label: "study_plan_items", group: "Adaptive", describe: (r) => String(r.title ?? "") },
  { key: "uploaded_materials", label: "uploaded_materials", group: "Materials & AI", describe: (r) => String(r.file_name ?? "") },
  { key: "ai_conversations", label: "ai_conversations", group: "Materials & AI", describe: (r) => String(r.title ?? "") },
  { key: "ai_messages", label: "ai_messages", group: "Materials & AI", describe: (r) => String(r.content ?? "").slice(0, 60) },
];

export function DataExplorerPage() {
  const db = useStore((d) => d);
  const [active, setActive] = useState<TableKey>("courses");
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, typeof TABLES>();
    TABLES.forEach((t) => {
      if (!map.has(t.group)) map.set(t.group, []);
      map.get(t.group)!.push(t);
    });
    return [...map.entries()];
  }, []);

  const rows = (db[active] as unknown as Record<string, unknown>[]) ?? [];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const filtered = search
    ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))
    : rows;

  return (
    <section className="page bleed" style={{ maxWidth: 1400 }}>
      <div className="page-heading">
        <div>
          <span className="eyebrow"><Database size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Schema explorer</span>
          <h1>Data Explorer</h1>
          <p>Every StudyLab entity — these tables mirror <code>supabase/migrations/0001_studylab_v0_1.sql</code>. The live demo is persisted in your browser via the same data-access layer.</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
        <div className="panel" style={{ padding: 10 }}>
          {groups.map(([group, items]) => (
            <div key={group} style={{ marginBottom: 10 }}>
              <div className="nav-label">{group}</div>
              {items.map((t) => {
                const count = (db[t.key] as unknown[]).length;
                return (
                  <button key={t.key} className={`nav-item ${active === t.key ? "active" : ""}`} style={{ fontSize: 13 }} onClick={() => setActive(t.key)}>
                    <Table2 size={15} /> {t.label}
                    <span className="nav-badge">{count}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-soft)", gap: 12 }}>
            <h3 style={{ fontFamily: "monospace" }}>{active} <span className="muted" style={{ fontFamily: "inherit" }}>· {rows.length} rows</span></h3>
            <div className="search" style={{ maxWidth: 280 }}>
              <Search size={15} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter rows..." />
            </div>
          </div>
          <div style={{ maxHeight: "calc(100vh - 280px)", overflow: "auto" }}>
            {columns.length === 0 ? (
              <p className="muted" style={{ padding: 30, textAlign: "center" }}>This table is empty.</p>
            ) : (
              <table>
                <thead>
                  <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map((r, i) => (
                    <tr key={i}>
                      {columns.map((c) => {
                        const v = (r as Record<string, unknown>)[c];
                        const display = v === null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
                        return (
                          <td key={c} style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={display}>
                            {c === "id" ? <code style={{ fontSize: 11, color: "var(--text-mute)" }}>{display.slice(0, 16)}…</code> : display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {filtered.length > 200 && <p className="muted" style={{ padding: 12, textAlign: "center" }}>Showing first 200 of {filtered.length} rows</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
