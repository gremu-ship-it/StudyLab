import { useMemo, useState } from "react";
import { Calendar, CheckCircle2, ChevronRight, Repeat, RotateCcw } from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import { dayLabel, masteryColor, toast } from "../components/ui";

export function ReviewPage({ nav }: { nav: NavFn }) {
  const db = useStore((d) => d);
  const sid = store.studentId;
  const [mode, setMode] = useState<"due" | "upcoming" | "all">("due");

  const reviews = useMemo(() => {
    const now = Date.now();
    return db.review_schedule
      .filter((r) => r.student_id === sid)
      .map((r) => {
        const topic = db.topics.find((t) => t.id === r.topic_id)!;
        const course = db.courses.find((c) => c.id === topic?.course_id);
        const due = new Date(r.scheduled_for).getTime();
        return { r, topic, course, isDue: due <= now, daysUntil: Math.round((due - now) / 86400000) };
      })
      .filter((x) => {
        if (mode === "due") return x.r.status === "scheduled" && x.isDue;
        if (mode === "upcoming") return x.r.status === "scheduled" && !x.isDue;
        return true;
      })
      .sort((a, b) => new Date(a.r.scheduled_for).getTime() - new Date(b.r.scheduled_for).getTime());
  }, [db, sid, mode]);

  const dueCount = db.review_schedule.filter((r) => r.student_id === sid && r.status === "scheduled" && new Date(r.scheduled_for).getTime() <= Date.now()).length;

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Spaced repetition</span>
          <h1>Review</h1>
          <p>Reviews are scheduled automatically as you practise. Short, frequent sessions build long-term retention.</p>
        </div>
        {dueCount > 0 && <button className="primary" onClick={() => nav({ name: "practice" })}><Repeat size={16} /> Start review ({dueCount})</button>}
      </div>

      <div className="tabs">
        <button className={`tab ${mode === "due" ? "active" : ""}`} onClick={() => setMode("due")}>Due now {dueCount > 0 && <span className="chip bad" style={{ marginLeft: 6 }}>{dueCount}</span>}</button>
        <button className={`tab ${mode === "upcoming" ? "active" : ""}`} onClick={() => setMode("upcoming")}>Upcoming</button>
        <button className={`tab ${mode === "all" ? "active" : ""}`} onClick={() => setMode("all")}>All history</button>
      </div>

      {reviews.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 size={34} />
          <h2>{mode === "due" ? "All caught up! 🎉" : "Nothing here yet"}</h2>
          <p>{mode === "due" ? "No reviews due. Keep practising to build your schedule." : "Reviews appear automatically after you answer practice questions."}</p>
          {mode === "due" && <button className="primary" onClick={() => nav({ name: "practice" })}><RotateCcw size={16} /> Practise something new</button>}
        </div>
      ) : (
        <div className="list">
          {reviews.map(({ r, topic, course, daysUntil }) => {
            const m = db.topic_mastery.find((x) => x.student_id === sid && x.topic_id === topic?.id);
            return (
              <div key={r.id} className="list-item">
                <div className="unit-type" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}><Repeat size={18} /></div>
                <div className="grow">
                  <h3>{topic?.name ?? "Topic"}</h3>
                  <p>{course?.code} · {course?.name} · interval {r.interval_days}d · ease {r.ease_factor.toFixed(2)}</p>
                </div>
                <div className="kv" style={{ alignItems: "flex-end", marginRight: 8 }}>
                  <span>Mastery</span>
                  <strong style={{ color: masteryColor(m?.mastery_score ?? 0), fontSize: 14 }}>{m?.mastery_score ?? 0}%</strong>
                </div>
                <span className={`chip ${r.status === "completed" ? "good" : daysUntil <= 0 ? "bad" : "muted"}`}>
                  <Calendar size={12} /> {r.status === "completed" ? "Done" : daysUntil <= 0 ? "Due now" : `in ${daysUntil}d · ${dayLabel(r.scheduled_for)}`}
                </span>
                {r.status === "scheduled" && (
                  <button className="secondary small" onClick={() => { store.completeReview(r.id); toast("Review complete"); }}><CheckCircle2 size={14} /> Done</button>
                )}
                {topic && <button className="ghost small" onClick={() => nav({ name: "course", courseId: topic.course_id })}><ChevronRight size={14} /></button>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
