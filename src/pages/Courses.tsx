import { useMemo, useState } from "react";
import { BookOpen, ChevronRight, Search } from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import { Empty, ErrorNote, Spinner } from "../components/ui";
import { Link } from "../router";

export function CoursesPage() {
  const { state } = useAuth();
  const profile = state.status === "ready" ? state.profile : null;
  const [search, setSearch] = useState("");

  const coursesQ = useQuery(() => (profile?.programme_id ? api.getCourses(profile.programme_id) : Promise.resolve([])), [profile?.programme_id]);
  const topicsQ = useQuery(async () => {
    const courses = coursesQ.data ?? [];
    return courses.length ? api.getTopicsForCourses(courses.map((c) => c.id)) : [];
  }, [(coursesQ.data ?? []).map((c) => c.id).join(",")]);
  const masteryQ = useQuery(api.getTopicMastery, []);

  const filtered = useMemo(() => {
    const list = coursesQ.data ?? [];
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter((c) => `${c.code} ${c.name} ${c.category ?? ""}`.toLowerCase().includes(s));
  }, [coursesQ.data, search]);

  if (coursesQ.error) return <div className="page"><ErrorNote message={coursesQ.error} onRetry={coursesQ.refresh} /></div>;
  if (coursesQ.loading)
    return (
      <div className="page">
        <Spinner label="Loading courses…" />
      </div>
    );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">BSC NATURAL & APPLIED SCIENCE</span>
          <h1>My Courses</h1>
          <p>The timetable is a starting point — topics enter as your lecturers introduce them.</p>
        </div>
      </div>

      <div className="search wide">
        <Search size={16} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses…" />
      </div>

      {(coursesQ.data ?? []).length === 0 ? (
        <Empty
          icon={<BookOpen size={36} />}
          title="No courses linked yet"
          body="Link your programme during onboarding, or ask your administrator to confirm the current courses."
        />
      ) : (
        <div className="course-grid">
          {filtered.map((c) => {
            const courseTopics = (topicsQ.data ?? []).filter((t) => t.course_id === c.id);
            const mastered = courseTopics.filter((t) => {
              const m = masteryQ.data?.find((r) => r.topic_id === t.id);
              return m && (m.mastery_level === "strong" || m.mastery_level === "mastered");
            }).length;
            return (
              <Link key={c.id} to={`/courses/${c.id}`} className="course-card">
                <div className="course-icon math">
                  <BookOpen size={19} />
                </div>
                <div className="course-main">
                  <span>
                    {c.code} · {c.status === "student_added" ? "student added" : c.status}
                  </span>
                  <h3>{c.name}</h3>
                  <small>{c.category ?? ""}</small>
                </div>
                <ChevronRight size={18} className="arrow" />
                <div className="progress-row">
                  <span>
                    {courseTopics.length} topic{courseTopics.length === 1 ? "" : "s"} · {mastered} mastered
                  </span>
                </div>
                {courseTopics.length > 0 && (
                  <div className="mastery">
                    <span>Course mastery</span>
                    <b>{Math.round((mastered / courseTopics.length) * 100)}%</b>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}


