// Student dashboard — answers "what should I study next?" and "why?".
// Sections: today's plan, continue learning, weak areas, review due,
// course progress, recent learning, recommendations.

import { useEffect, useMemo } from "react";
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock,
  PlayCircle,
  Repeat,
  Target,
} from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import { generateRecommendations, type RecSnapshot } from "../lib/recommendations";
import type { MasteryEstimate, MasteryLevel } from "../lib/mastery";
import { Button, Card, Empty, ErrorNote, MasteryBadge, SectionHead, Spinner } from "../components/ui";
import { Link, navigate } from "../router";
import type { TopicMastery } from "../types";

export function Dashboard() {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  const profile = state.status === "ready" ? state.profile : null;

  const programmeId = profile?.programme_id ?? null;

  const coursesQ = useQuery(() => (programmeId ? api.getCourses(programmeId) : Promise.resolve([])), [programmeId]);
  const topicMasteryQ = useQuery(api.getTopicMastery, [user?.id]);
  const sessionsQ = useQuery(api.getActiveSessions, [user?.id]);
  const reviewsQ = useQuery(api.getReviews, [user?.id]);

  const courseIds = useMemo(() => (coursesQ.data ?? []).map((c) => c.id), [coursesQ.data]);
  const topicsQ = useQuery(
    () => (courseIds.length ? api.getTopicsForCourses(courseIds) : Promise.resolve([])),
    [courseIds.join(",")],
  );
  const masteryByTopic = useMemo(() => {
    const m: Record<string, TopicMastery> = {};
    for (const row of topicMasteryQ.data ?? []) m[row.topic_id] = row;
    return m;
  }, [topicMasteryQ.data]);

  // ---- recommendations (computed from live data, persisted for history) ----
  const snapshot: RecSnapshot | null = useMemo(() => {
    if (!topicsQ.data || !coursesQ.data || !topicMasteryQ.data || !reviewsQ.data || !sessionsQ.data) return null;
    const reviews: Record<string, string> = {};
    for (const r of reviewsQ.data) if (r.status === "scheduled") reviews[r.topic_id] = r.scheduled_for;
    return {
      now: new Date(),
      topics: topicsQ.data.map((t) => {
        const course = coursesQ.data!.find((c) => c.id === t.course_id);
        return {
          id: t.id,
          course_id: t.course_id,
          courseName: course?.name ?? "",
          name: t.name,
          sequence_number: t.sequence_number,
          status: t.status,
        };
      }),
      mastery: Object.fromEntries(
        topicsQ.data.map((t) => {
          const m = masteryByTopic[t.id];
          const est: MasteryEstimate = m
            ? {
                score: m.mastery_score,
                level: (m.mastery_level as MasteryLevel) ?? "not_assessed",
                confidence: m.confidence_score,
                attempts: m.attempt_count,
                easyAccuracy: null,
                applicationAccuracy: null,
                applicationGap: false,
              }
            : { score: 0, level: "not_assessed", confidence: 0, attempts: 0, easyAccuracy: null, applicationAccuracy: null, applicationGap: false };
          return [t.id, est];
        }),
      ),
      reviews,
      prerequisiteEdges: [], // topic prerequisites surface in phase 7 wiring
      activeSessions: Object.fromEntries(
        sessionsQ.data.map((s) => [
          s.topic_id,
          {
            progressPercent: Math.min(100, Math.max(0, s.current_step)),
            sessionTitle: s.title ?? "",
          },
        ]),
      ),
    };
  }, [topicsQ.data, coursesQ.data, topicMasteryQ.data, reviewsQ.data, sessionsQ.data, masteryByTopic]);

  const recs = useMemo(() => (snapshot ? generateRecommendations(snapshot) : []), [snapshot]);

  // Persist computed recommendations that are not already stored.
  const storedRecsQ = useQuery(api.getActiveRecommendations, [user?.id]);
  useEffect(() => {
    if (!user || !recs.length || !storedRecsQ.data) return;
    const existing = new Set(storedRecsQ.data.map((r) => `${r.recommendation_type}:${r.topic_id ?? ""}`));
    for (const r of recs) {
      const key = `${r.type}:${r.topic_id ?? ""}`;
      if (!existing.has(key)) {
        void api.insertRecommendation({
          student_id: user.id,
          course_id: r.course_id,
          topic_id: r.topic_id,
          recommendation_type: r.type,
          priority: r.priority,
          reason: r.reason,
        }).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recs, storedRecsQ.data, user?.id]);

  const loading = coursesQ.loading || topicsQ.loading || topicMasteryQ.loading;
  const error = coursesQ.error ?? topicsQ.error ?? topicMasteryQ.error;
  if (error) return <section className="page"><ErrorNote message={error} onRetry={coursesQ.refresh} /></section>;
  if (loading)
    return (
      <section className="page">
        <Spinner label="Preparing your learning dashboard…" />
      </section>
    );

  const courses = coursesQ.data ?? [];
  const topics = topicsQ.data ?? [];
  const activeSessions = sessionsQ.data ?? [];
  const reviews = (reviewsQ.data ?? []).filter((r) => r.status === "scheduled" && new Date(r.scheduled_for) <= new Date());
  const weakTopics = topics.filter((t) => {
    const m = masteryByTopic[t.id];
    return m && (m.mastery_level === "weak" || m.mastery_level === "developing") && m.attempt_count > 0;
  });

  const topicName = (id: string | null) => topics.find((t) => t.id === id)?.name ?? "a topic";
  const courseName = (id: string | null) => courses.find((c) => c.id === id)?.name ?? "";
  const top = recs[0];

  function recommendAction(r: (typeof recs)[number]) {
    if (!r.topic_id) return;
    if (r.type === "continue" || r.type === "fresh_start" || r.type === "application_practice" || r.type === "weak_area" || r.type === "ready_next" || r.type === "review") {
      navigate(`/topics/${r.topic_id}`);
    } else if (r.type === "prerequisite" && r.related_topic_id) {
      navigate(`/topics/${r.related_topic_id}`);
    }
  }

  return (
    <section className="page">
      <div className="hero">
        <div>
          <span className="eyebrow">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase()}</span>
          <h1>Hello {profile?.full_name?.split(" ")[0] ?? "there"} 👋</h1>
          <p>
            {top
              ? `Suggested next: ${top.title}. ${top.reason}`
              : "Add topics and materials to build your personalised plan."}
          </p>
          <div className="hero-actions">
            {top && (
              <button className="primary" onClick={() => recommendAction(top)}>
                <PlayCircle size={17} /> {top.title}
              </button>
            )}
            <button className="secondary" onClick={() => navigate("/materials")}>
              <ClipboardList size={16} /> Add course material
            </button>
          </div>
        </div>
        <div className="hero-orb">
          <Target size={70} strokeWidth={1.2} />
        </div>
      </div>

      {/* Stats row */}
      <div className="stats">
        <Stat icon={<Target />} label="Topics started" value={String(Object.values(masteryByTopic).filter((m) => m.attempt_count > 0).length)} note={`of ${topics.length} in current courses`} />
        <Stat icon={<PlayCircle />} label="Sessions in progress" value={String(activeSessions.length)} note="Resume any time" />
        <Stat icon={<Repeat />} label="Reviews due" value={String(reviews.length)} note={reviews.length ? "Best done today" : "You're up to date"} />
        <Stat icon={<AlertTriangle />} label="Areas to strengthen" value={String(weakTopics.length)} note="Based on recent practice" />
      </div>

      {/* Continue learning */}
      {activeSessions.length > 0 && (
        <>
          <SectionHead title="Continue learning" sub="Pick up exactly where you stopped" />
          <div className="continue-list">
            {activeSessions.map((s) => (
              <Card key={s.id} className="continue-card">
                <div className="continue-icon">
                  <PlayCircle size={20} />
                </div>
                <div className="continue-main">
                  <span>
                    {courseName(s.topic_id)} · {topicName(s.topic_id)}
                  </span>
                  <h3>{s.title ?? "Learning session"}</h3>
                  <div className="progress">
                    <i style={{ width: `${Math.min(100, s.current_step)}%` }} />
                  </div>
                </div>
                <Button onClick={() => navigate(`/session/${s.id}`)}>Resume <ChevronRight size={15} /></Button>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Recommendations */}
      {recs.length > 0 && (
        <>
          <SectionHead title="Recommended next" sub="Each suggestion explains why" />
          <div className="recommend-grid">
            {recs.slice(0, 6).map((r) => (
              <Card key={r.id} className="recommend-card">
                <div className="rec-top">
                  <span className={`priority ${r.type === "continue" || r.type === "prerequisite" ? "high" : r.type === "review" || r.type === "weak_area" || r.type === "application_practice" ? "medium" : "low"}`}>
                    {r.type.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="eyebrow">{courseName(r.course_id)}</span>
                <h3>{r.title}</h3>
                <p>{r.reason}</p>
                <div className="hero-actions">
                  <Button onClick={() => recommendAction(r)}>Start <ChevronRight size={14} /></Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      // persisted only if stored; else local dismiss via stored id
                      const stored = storedRecsQ.data?.find((x) => x.recommendation_type === r.type && x.topic_id === r.topic_id);
                      if (stored) void api.setRecommendationStatus(stored.id, "dismissed");
                    }}
                  >
                    Dismiss
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Weak areas */}
      {weakTopics.length > 0 && (
        <>
          <SectionHead title="Weak areas" sub="Practice here will move your mastery fastest" />
          <div className="weak-list">
            {weakTopics.slice(0, 5).map((t) => {
              const m = masteryByTopic[t.id];
              return (
                <Card key={t.id} className="weak-card">
                  <div>
                    <span>{courseName(t.course_id)}</span>
                    <h3>{t.name}</h3>
                  </div>
                  <MasteryBadge level={m.mastery_level} score={m.mastery_score} />
                  <Link to={`/topics/${t.id}`} className="text-btn">
                    Work on it <ChevronRight size={14} />
                  </Link>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Review due */}
      {reviews.length > 0 && (
        <>
          <SectionHead title="Review due" sub="Spaced repetition keeps it in long-term memory" />
          <div className="weak-list">
            {reviews.slice(0, 5).map((r) => (
              <Card key={r.id} className="weak-card">
                <div>
                  <span>
                    <Clock size={12} /> due {new Date(r.scheduled_for).toLocaleDateString("en-GB")}
                  </span>
                  <h3>{topicName(r.topic_id)}</h3>
                </div>
                <Button variant="secondary" onClick={() => navigate(`/topics/${r.topic_id}`)}>
                  Review <ChevronRight size={14} />
                </Button>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Courses */}
      <SectionHead
        title="Current courses"
        sub="Your curriculum grows as your lecturers introduce topics"
        action={
          <Link to="/courses" className="text-btn">
            View all <ChevronRight size={16} />
          </Link>
        }
      />
      {courses.length === 0 ? (
        <Empty
          icon={<BookOpen size={36} />}
          title="No courses yet"
          body="Once your programme is linked, the current courses appear here. Topics you add flow in from the course workspace."
          actions={
            <Button onClick={() => navigate("/courses")}>
              <CalendarDays size={15} /> View courses
            </Button>
          }
        />
      ) : (
        <div className="course-grid compact">
          {courses.slice(0, 6).map((c) => {
            const courseTopics = topics.filter((t) => t.course_id === c.id);
            const done = courseTopics.filter((t) => {
              const m = masteryByTopic[t.id];
              return m && (m.mastery_level === "strong" || m.mastery_level === "mastered");
            }).length;
            const pct = courseTopics.length ? Math.round((done / courseTopics.length) * 100) : 0;
            return (
              <Link key={c.id} to={`/courses/${c.id}`} className="course-card">
                <div className="course-icon math">
                  <BookOpen size={19} />
                </div>
                <div className="course-main">
                  <span>{c.code}</span>
                  <h3>{c.name}</h3>
                  <small>{courseTopics.length} topic{courseTopics.length === 1 ? "" : "s"}</small>
                </div>
                <ChevronRight size={18} className="arrow" />
                <div className="progress-row">
                  <span>Mastered topics</span>
                  <strong>{pct}%</strong>
                </div>
                <div className="progress">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Recent learning */}
      <RecentLearning />
    </section>
  );
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </div>
  );
}

function RecentLearning() {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  const q = useQuery(async () => {
    if (!user) return [];
    const rows = await (api.getTopicMastery() as Promise<TopicMastery[]>);
    const practiced = rows
      .filter((r) => r.last_practiced_at)
      .sort((a, b) => (b.last_practiced_at ?? "").localeCompare(a.last_practiced_at ?? ""))
      .slice(0, 5);
    return practiced;
  }, [user?.id]);
  const topicsQ = useQuery(async () => {
    const profile = state.status === "ready" ? state.profile : null;
    if (!profile?.programme_id) return [];
    const courses = await api.getCourses(profile.programme_id);
    return courses.length ? api.getTopicsForCourses(courses.map((c) => c.id)) : [];
  }, [user?.id, state.status]);

  if (q.loading || !q.data?.length) return null;

  return (
    <>
      <SectionHead title="Recent learning" sub="Where you've practised most recently" />
      <div className="weak-list">
        {q.data.map((r) => {
          const t = topicsQ.data?.find((x) => x.id === r.topic_id);
          return (
            <Card key={r.id} className="weak-card">
              <div>
                <span>
                  <CalendarDays size={12} />{" "}
                  {r.last_practiced_at ? new Date(r.last_practiced_at).toLocaleDateString("en-GB") : ""}
                </span>
                <h3>{t?.name ?? "Topic"}</h3>
              </div>
              <MasteryBadge level={r.mastery_level} score={r.mastery_score} />
            </Card>
          );
        })}
      </div>
    </>
  );
}
