// Adaptive recommendation engine (pure, deterministic, explainable).
//
// Every recommendation carries a `reason` — the dashboard answers
// "what should I study next?" *and* "why?".
//
// Rules (in priority order):
//  1. continue   — an in-progress session exists (resume where you stopped)
//  2. prereq     — a topic's prerequisite topic is not yet solid
//  3. app-gap    — theory is fine but application items fail (mastery engine)
//  4. review-due — spaced-repetition review is overdue
//  5. weak       — low mastery after several attempts
//  6. ready      — a topic is solid and the next one in the course is new
//  7. fresh      — a topic has never been touched (start somewhere)

import type { MasteryEstimate } from "./mastery";
import { daysBetween } from "./mastery";

export interface RecTopic {
  id: string;
  course_id: string;
  courseName: string;
  name: string;
  sequence_number: number | null;
  status: string;
}

export interface RecSnapshot {
  now: Date;
  topics: RecTopic[];
  /** topicId → estimate */
  mastery: Record<string, MasteryEstimate>;
  /** topicId → next review due (ISO) */
  reviews: Record<string, string>;
  /** prerequisite edges: prerequisiteTopicId → dependentTopicId */
  prerequisiteEdges: { from: string; to: string }[];
  /** in-progress sessions: topicId → { progressPercent, sessionTitle } */
  activeSessions: Record<string, { progressPercent: number; sessionTitle: string }>;
}

export interface GeneratedRecommendation {
  id: string;
  type:
    | "continue"
    | "prerequisite"
    | "application_practice"
    | "review"
    | "weak_area"
    | "ready_next"
    | "fresh_start";
  priority: number; // higher = more urgent
  course_id: string | null;
  topic_id: string | null;
  /** secondary topic (e.g. the prerequisite) for link targets */
  related_topic_id: string | null;
  title: string;
  reason: string;
}

function topicById(snap: RecSnapshot, id: string): RecTopic | undefined {
  return snap.topics.find((t) => t.id === id);
}

export function generateRecommendations(snap: RecSnapshot): GeneratedRecommendation[] {
  const out: GeneratedRecommendation[] = [];
  const seen = new Set<string>();
  const add = (r: GeneratedRecommendation) => {
    const key = `${r.type}:${r.topic_id ?? ""}:${r.related_topic_id ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(r);
  };

  const levelOk = (m?: MasteryEstimate) =>
    Boolean(m && (m.level === "strong" || m.level === "mastered"));

  // 1. Continue in-progress sessions
  for (const [topicId, s] of Object.entries(snap.activeSessions)) {
    const t = topicById(snap, topicId);
    if (!t) continue;
    add({
      id: `continue:${topicId}`,
      type: "continue",
      priority: 100,
      course_id: t.course_id,
      topic_id: topicId,
      related_topic_id: null,
      title: `Continue “${t.name}”`,
      reason: `Your learning session is ${s.progressPercent}% complete — finishing it keeps the momentum and closes the loop on this topic.`,
    });
  }

  // 2. Prerequisite gaps (topic B depends on topic A; A is not solid)
  for (const edge of snap.prerequisiteEdges) {
    const a = topicById(snap, edge.from);
    const b = topicById(snap, edge.to);
    if (!a || !b) continue;
    const ma = snap.mastery[edge.from];
    const mb = snap.mastery[edge.to];
    if (levelOk(ma)) continue; // prerequisite already solid
    if (mb && (mb.level === "strong" || mb.level === "mastered")) continue; // dependent already fine
    add({
      id: `prereq:${edge.from}:${edge.to}`,
      type: "prerequisite",
      priority: 80,
      course_id: b.course_id,
      topic_id: b.id,
      related_topic_id: a.id,
      title: `Review “${a.name}” before “${b.name}”`,
      reason: `“${b.name}” builds directly on “${a.name}”, which is not yet solid (${ma ? ma.level : "not assessed"}). Strengthening the base first avoids carrying gaps forward.`,
    });
  }

  // 3. Application gaps — theory OK, practice fails
  for (const t of snap.topics) {
    const m = snap.mastery[t.id];
    if (!m || !m.applicationGap) continue;
    add({
      id: `app-gap:${t.id}`,
      type: "application_practice",
      priority: 70,
      course_id: t.course_id,
      topic_id: t.id,
      related_topic_id: null,
      title: `Apply “${t.name}” — practice over theory`,
      reason: `You score well on basic “${t.name}” items (${m.easyAccuracy ?? "n/a"}%) but struggle on application-level items (${m.applicationAccuracy ?? "n/a"}%). Work the application problems until they feel automatic.`,
    });
  }

  // 4. Reviews due (spaced repetition)
  for (const [topicId, dueISO] of Object.entries(snap.reviews)) {
    const t = topicById(snap, topicId);
    if (!t) continue;
    const due = new Date(dueISO);
    const overdueDays = daysBetween(due, snap.now);
    if (overdueDays < 0) continue; // not due yet
    add({
      id: `review:${topicId}`,
      type: "review",
      priority: 60 + Math.min(20, overdueDays),
      course_id: t.course_id,
      topic_id: topicId,
      related_topic_id: null,
      title: `Review “${t.name}”`,
      reason:
        overdueDays === 0
          ? `Your spaced-repetition review for “${t.name}” is due today — a 10-minute pass protects long-term retention.`
          : `You have not reviewed “${t.name}” for ${overdueDays} day${overdueDays === 1 ? "" : "s"} — retention decays without a refresh.`,
    });
  }

  // 5. Weak areas (enough evidence, still low)
  for (const t of snap.topics) {
    const m = snap.mastery[t.id];
    if (!m || m.attempts < 3 || m.level !== "weak") continue;
    add({
      id: `weak:${t.id}`,
      type: "weak_area",
      priority: 65,
      course_id: t.course_id,
      topic_id: t.id,
      related_topic_id: null,
      title: `Rebuild the foundations of “${t.name}”`,
      reason: `Across ${m.attempts} attempts your “${t.name}” score is ${m.score}%. A short foundation pass (explanations + easy items) before more practice will pay off fastest here.`,
    });
  }

  // 6. Ready for the next topic in the course
  const byCourse = new Map<string, RecTopic[]>();
  for (const t of snap.topics) {
    if (t.status === "archived") continue;
    const list = byCourse.get(t.course_id) ?? [];
    list.push(t);
    byCourse.set(t.course_id, list);
  }
  for (const list of byCourse.values()) {
    const sorted = [...list].sort(
      (a, b) => (a.sequence_number ?? 999) - (b.sequence_number ?? 999),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const done = sorted[i];
      const next = sorted[i + 1];
      const md = snap.mastery[done.id];
      const mn = snap.mastery[next.id];
      if (levelOk(md) && (!mn || mn.level === "not_assessed" || mn.attempts === 0)) {
        add({
          id: `ready:${next.id}`,
          type: "ready_next",
          priority: 40,
          course_id: next.course_id,
          topic_id: next.id,
          related_topic_id: done.id,
          title: `You're ready for “${next.name}”`,
          reason: `“${done.name}” is ${md!.level} and “${next.name}” hasn't started yet — the sequencing is right to move on now.`,
        });
        break;
      }
    }
  }

  // 7. Fresh start (fallback so the dashboard is never empty of guidance)
  const untouched = snap.topics.filter(
    (t) => t.status !== "archived" && (!snap.mastery[t.id] || snap.mastery[t.id].attempts === 0),
  );
  if (!out.length && untouched.length) {
    const t = untouched.sort((a, b) => (a.sequence_number ?? 999) - (b.sequence_number ?? 999))[0];
    add({
      id: `fresh:${t.id}`,
      type: "fresh_start",
      priority: 30,
      course_id: t.course_id,
      topic_id: t.id,
      related_topic_id: null,
      title: `Start “${t.name}” (${t.courseName})`,
      reason: `This topic has no practice data yet. A 20-minute learning session establishes a baseline the rest of the system builds on.`,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
