import { CalendarDays, ChevronRight, ClipboardList, PlayCircle, Plus, Repeat, Sparkles, Target, TrendingUp } from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import { masteryColor, levelLabel } from "../components/ui";

export function Dashboard({ nav }: { nav: NavFn }) {
  const db = useStore((d) => d);
  const sid = store.studentId;
  const topics = db.topics;
  const masteryRows = db.topic_mastery.filter((m) => m.student_id === sid);
  const overall = Math.round(masteryRows.reduce((s, m) => s + m.mastery_score, 0) / (masteryRows.length || 1));
  const weekSeconds = db.study_sessions
    .filter((s) => Date.now() - new Date(s.started_at).getTime() < 7 * 86400000)
    .reduce((s, x) => s + (x.duration_seconds ?? 0), 0);
  const dueReviews = db.review_schedule.filter(
    (r) => r.student_id === sid && r.status === "scheduled" && new Date(r.scheduled_for).getTime() <= Date.now() + 86400000
  ).length;
  const studentAdded = topics.filter((t) => t.status === "student_added").length;
  const recs = db.recommendations.filter((r) => r.student_id === sid && r.status === "active").sort((a, b) => b.priority - a.priority);
  const planItems = db.study_plan_items.filter((i) => i.study_plan_id === "plan-today");
  const completedToday = planItems.filter((i) => i.status === "completed").length;

  const priorityLabel = (p: number) => (p >= 85 ? "High" : p >= 65 ? "Medium" : "Low");

  return (
    <section className="page">
      <div className="hero">
        <div>
          <span className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()}</span>
          <h1>Good afternoon 👋</h1>
          <p>Your adaptive learning engine is ready. {completedToday}/{planItems.length} plan items done today — keep the streak going.</p>
          <div className="hero-actions">
            <button className="primary" onClick={() => nav({ name: "study" })}><PlayCircle size={17} /> Start 45-min session</button>
            <button className="secondary" onClick={() => nav({ name: "inbox" })}><Plus size={17} /> Add today's topic</button>
          </div>
        </div>
        <div className="hero-orb">
          <div className="ring-wrap">
            <div className="ring" style={{ ["--p" as string]: overall, ["--c" as string]: masteryColor(overall) }} />
            <div style={{ position: "absolute", textAlign: "center" }}>
              <strong style={{ fontSize: 22 }}>{overall}%</strong>
              <small style={{ display: "block" }}>mastery</small>
            </div>
          </div>
        </div>
      </div>

      <div className="stats">
        <Stat icon={<Target size={20} />} label="Overall mastery" value={`${overall}%`} note={levelLabel[masteryRows.find((m) => m.mastery_score === overall)?.mastery_level ?? "functional"] ?? "Across active topics"} />
        <Stat icon={<CalendarDays size={20} />} label="Study this week" value={fmtWeek(weekSeconds)} note="Target: 5 hours" />
        <Stat icon={<Repeat size={20} />} label="Reviews due" value={String(dueReviews)} note="Best done today" />
        <Stat icon={<Sparkles size={20} />} label="Topics in system" value={String(topics.length)} note={`${studentAdded} added by you`} />
      </div>

      <div className="section-head">
        <div><h2>Today's plan</h2><p>{planItems.length} adaptive blocks totalling {planItems.reduce((s, i) => s + i.planned_minutes, 0)} minutes</p></div>
        <button className="text-btn" onClick={() => nav({ name: "study" })}>Open plan <ChevronRight size={16} /></button>
      </div>
      <div className="panel">
        {planItems.map((i) => {
          const topic = topics.find((t) => t.id === i.topic_id);
          const course = topic ? db.courses.find((c) => c.id === topic.course_id) : null;
          return (
            <div key={i.id} className="list-item" style={{ background: "transparent", border: "none", padding: "10px 4px", borderBottom: "1px solid var(--border-soft)" }}>
              <button className="icon-btn" style={{ width: 30, height: 30 }} onClick={() => store.togglePlanItem(i.id)}>
                {i.status === "completed" ? <CheckBadge /> : <Circle />}
              </button>
              <div className="grow">
                <h3 style={{ textDecoration: i.status === "completed" ? "line-through" : "none", color: i.status === "completed" ? "var(--text-mute)" : "var(--text)" }}>{i.title}</h3>
                <p>{course?.code} • {i.planned_minutes} min</p>
              </div>
              <button className="ghost small" onClick={() => topic && nav({ name: "course", courseId: topic.course_id })}>Open <ChevronRight size={14} /></button>
            </div>
          );
        })}
      </div>

      <div className="section-head">
        <div><h2>Recommended next</h2><p>Prioritised by mastery, recency and spaced repetition</p></div>
        <button className="text-btn" onClick={() => nav({ name: "practice" })}>All practice <ChevronRight size={16} /></button>
      </div>
      <div className="recommend-grid">
        {recs.slice(0, 4).map((r) => {
          const topic = topics.find((t) => t.id === r.topic_id);
          return (
            <div key={r.id} className="recommend-card">
              <div className="rec-top">
                <span className={`priority ${priorityLabel(r.priority).toLowerCase()}`}>{priorityLabel(r.priority)}</span>
                <span>{r.minutes} min</span>
              </div>
              <span className="eyebrow">{topic ? db.courses.find((c) => c.id === topic.course_id)?.name : "StudyLab"}</span>
              <h3>{topic?.name ?? "Study activity"}</h3>
              <p>{r.reason}</p>
              <div className="row">
                <button className="primary small" style={{ flex: 1, justifyContent: "center" }} onClick={() => {
                  store.actOnRecommendation(r.id);
                  if (r.recommendation_type === "review") nav({ name: "review" });
                  else if (r.recommendation_type === "practical") nav({ name: "practicals" });
                  else if (r.recommendation_type === "upload_material") nav({ name: "materials" });
                  else if (topic) nav({ name: "practice", topicId: topic.id });
                  else nav({ name: "practice" });
                }}><PlayCircle size={14} /> Start</button>
                <button className="ghost small" onClick={() => store.dismissRecommendation(r.id)}>Dismiss</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-head">
        <div><h2>Mastery snapshot</h2><p>Strongest and weakest topics right now</p></div>
        <button className="text-btn" onClick={() => nav({ name: "mastery" })}>Full mastery <ChevronRight size={16} /></button>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-head"><h3><TrendingUp size={15} style={{ display: "inline", verticalAlign: "-2px", color: "var(--good)" }} /> Strongest</h3></div>
          {[...masteryRows].sort((a, b) => b.mastery_score - a.mastery_score).slice(0, 3).map((m) => {
            const topic = topics.find((t) => t.id === m.topic_id)!;
            return <MasteryBar key={m.id} name={topic.name} code={db.courses.find((c) => c.id === topic.course_id)?.code ?? ""} score={m.mastery_score} />;
          })}
        </div>
        <div className="panel">
          <div className="panel-head"><h3><ClipboardList size={15} style={{ display: "inline", verticalAlign: "-2px", color: "var(--warn)" }} /> Needs work</h3></div>
          {[...masteryRows].filter((m) => m.mastery_score > 0).sort((a, b) => a.mastery_score - b.mastery_score).slice(0, 3).map((m) => {
            const topic = topics.find((t) => t.id === m.topic_id)!;
            return <MasteryBar key={m.id} name={topic.name} code={db.courses.find((c) => c.id === topic.course_id)?.code ?? ""} score={m.mastery_score} />;
          })}
        </div>
      </div>
    </section>
  );
}

function MasteryBar({ name, code, score }: { name: string; code: string; score: number }) {
  return (
    <div className="mastery-row">
      <div className="label"><strong>{name}</strong><span>{code}</span></div>
      <div className="bar"><i style={{ width: `${score}%`, background: masteryColor(score) }} /></div>
      <div className="pct" style={{ color: masteryColor(score) }}>{score}%</div>
    </div>
  );
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="stat"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function fmtWeek(s: number) {
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

function Circle() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--text-mute)" }}><circle cx="12" cy="12" r="9" /></svg>; }
function CheckBadge() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="2.4"><circle cx="12" cy="12" r="9" fill="rgba(52,211,153,.15)" /><path d="M8 12l3 3 5-6" /></svg>; }
