import { useMemo } from "react";
import { BookOpen, ChevronRight } from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import { categoryAccent } from "../components/ui";

export function CoursesPage({ nav, search }: { nav: NavFn; search: string }) {
  const db = useStore((d) => d);
  const sid = store.studentId;

  const coursesWithStats = useMemo(() => {
    return db.courses.map((c) => {
      const topics = db.topics.filter((t) => t.course_id === c.id);
      const m = db.topic_mastery.filter((x) => x.student_id === sid && topics.some((t) => t.id === x.topic_id));
      const mastery = m.length ? Math.round(m.reduce((s, x) => s + x.mastery_score, 0) / m.length) : 0;
      const offering = db.course_offerings.find((o) => o.course_id === c.id);
      return { course: c, topics: topics.length, mastery, lecturer: offering?.lecturer_name };
    });
  }, [db, sid]);

  const filtered = coursesWithStats.filter((c) =>
    `${c.course.name} ${c.course.code} ${c.course.category ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(filtered.map((c) => c.course.category ?? "Other"))];

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">BSc Natural & Applied Science · Year 2 Semester 1</span>
          <h1>My Courses</h1>
          <p>{filtered.length} courses · {filtered.reduce((s, c) => s + c.topics, 0)} topics in your curriculum</p>
        </div>
        <button className="primary" onClick={() => nav({ name: "inbox" })}>Add topic</button>
      </div>

      {categories.map((cat) => {
        const items = filtered.filter((c) => (c.course.category ?? "Other") === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div className="section-head"><h2 style={{ fontSize: 15 }}>{cat}</h2><span className="muted">{items.length} courses</span></div>
            <div className="course-grid">
              {items.map(({ course, topics, mastery, lecturer }) => (
                <button key={course.id} className="course-card" onClick={() => nav({ name: "course", courseId: course.id })}>
                  <div className={`course-icon ${categoryAccent[course.category ?? ""] ?? "math"}`}><BookOpen size={19} /></div>
                  <div className="course-main">
                    <span>{course.code}</span>
                    <h3>{course.name}</h3>
                    <small>{lecturer ?? course.category}{course.credits ? ` · ${course.credits} credits` : ""}</small>
                  </div>
                  <ChevronRight size={18} className="arrow" />
                  <div className="progress-row"><span>{topics} topic{topics === 1 ? "" : "s"}</span><strong>{mastery}%</strong></div>
                  <div className="progress"><i style={{ width: `${mastery}%` }} /></div>
                  <div className="mastery"><span>Mastery</span><b>{mastery}%</b></div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
