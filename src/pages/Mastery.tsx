import { useMemo, useState } from "react";
import { Brain, ChevronRight, Cpu, Target } from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import { levelLabel, masteryColor } from "../components/ui";

export function MasteryPage({ nav }: { nav: NavFn }) {
  const db = useStore((d) => d);
  const sid = store.studentId;
  const [view, setView] = useState<"topics" | "skills">("topics");

  const topicRows = useMemo(() =>
    db.topic_mastery
      .filter((m) => m.student_id === sid)
      .map((m) => {
        const topic = db.topics.find((t) => t.id === m.topic_id)!;
        const course = db.courses.find((c) => c.id === topic.course_id);
        return { m, topic, course };
      })
      .sort((a, b) => b.m.mastery_score - a.m.mastery_score),
    [db, sid]
  );

  const skillRows = useMemo(() =>
    db.skill_mastery
      .filter((m) => m.student_id === sid)
      .map((m) => ({ m, skill: db.skills.find((s) => s.id === m.skill_id)! }))
      .filter((x) => x.skill)
      .sort((a, b) => b.m.mastery_score - a.m.mastery_score),
    [db, sid]
  );

  const overall = Math.round(topicRows.reduce((s, x) => s + x.m.mastery_score, 0) / (topicRows.length || 1));
  const mastered = topicRows.filter((x) => x.m.mastery_score >= 75).length;
  const notStarted = topicRows.filter((x) => x.m.mastery_score === 0).length;
  const totalAttempts = topicRows.reduce((s, x) => s + x.m.attempt_count, 0);

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Learning analytics</span>
          <h1>Mastery</h1>
          <p>How well you know each topic and skill, updated by every question and unit you complete.</p>
        </div>
      </div>

      <div className="stats" style={{ marginBottom: 18 }}>
        <div className="stat"><div className="stat-icon"><Target size={20} /></div><div><span>Overall mastery</span><strong style={{ color: masteryColor(overall) }}>{overall}%</strong><small>across {topicRows.length} topics</small></div></div>
        <div className="stat"><div className="stat-icon"><Brain size={20} /></div><div><span>Strong/mastered</span><strong>{mastered}</strong><small>topics at ≥75%</small></div></div>
        <div className="stat"><div className="stat-icon"><Cpu size={20} /></div><div><span>Skills tracked</span><strong>{skillRows.length}</strong><small>procedural & conceptual</small></div></div>
        <div className="stat"><div className="stat-icon"><ChevronRight size={20} /></div><div><span>Total attempts</span><strong>{totalAttempts}</strong><small>{notStarted} not started</small></div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${view === "topics" ? "active" : ""}`} onClick={() => setView("topics")}>Topic mastery</button>
        <button className={`tab ${view === "skills" ? "active" : ""}`} onClick={() => setView("skills")}>Skill mastery</button>
      </div>

      <div className="panel">
        {view === "topics" && topicRows.map(({ m, topic, course }) => (
          <button key={m.id} className="mastery-row" style={{ background: "none", border: "none", borderBottom: "1px solid var(--border-soft)", width: "100%", textAlign: "left", cursor: "pointer" }}
            onClick={() => course && nav({ name: "course", courseId: course.id })}>
            <div className="label"><strong>{topic.name}</strong><span>{course?.code} · {course?.name}</span></div>
            <div className="bar"><i style={{ width: `${m.mastery_score}%`, background: masteryColor(m.mastery_score) }} /></div>
            <div className="lvl"><span className={`chip ${m.mastery_score >= 75 ? "good" : m.mastery_score >= 35 ? "warn" : m.mastery_score > 0 ? "brand" : "muted"}`}>{levelLabel[m.mastery_level]}</span></div>
            <div className="pct" style={{ color: masteryColor(m.mastery_score) }}>{m.mastery_score}%</div>
          </button>
        ))}
        {view === "skills" && (
          skillRows.length === 0
            ? <p className="muted" style={{ padding: 20, textAlign: "center" }}>Skill mastery builds as you answer questions. Start a practice set.</p>
            : skillRows.map(({ m, skill }) => (
              <div key={m.id} className="mastery-row">
                <div className="label"><strong>{skill.name}</strong><span>{skill.skill_type}</span></div>
                <div className="bar"><i style={{ width: `${m.mastery_score}%`, background: masteryColor(m.mastery_score) }} /></div>
                <div className="lvl"><span className="chip muted">{m.attempt_count} attempts</span></div>
                <div className="pct" style={{ color: masteryColor(m.mastery_score) }}>{m.mastery_score}%</div>
              </div>
            ))
        )}
      </div>
    </section>
  );
}
