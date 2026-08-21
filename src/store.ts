import { useSyncExternalStore } from "react";
import seed from "./seed";
import type {
  AIMessage, AIConversation, Database, LearningAttempt, MasteryLevel, QuestionAttempt,
  ReviewSchedule, StudySession, Topic, UUID,
} from "./types";

const STORAGE_KEY = "studylab.db.v1";
const STUDENT_ID = "student-1";

type Listener = () => void;

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function load(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      // basic shape guard
      if (parsed && Array.isArray(parsed.courses) && Array.isArray(parsed.topics)) return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  return deepClone(seed);
}

let state: Database = load();
const listeners = new Set<Listener>();

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage may be full / unavailable; ignore */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export const uid = (prefix = "id"): UUID =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const store = {
  get: () => state,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  reset() {
    state = deepClone(seed);
    emit();
  },
  studentId: STUDENT_ID,

  // ---- generic helpers ----
  insert<K extends keyof Database>(table: K, row: Database[K][number]) {
    (state[table] as unknown[]).unshift(row as unknown);
    emit();
  },
  update<K extends keyof Database>(table: K, id: UUID, patch: Partial<Database[K][number]>) {
    const rows = state[table] as unknown as Array<{ id: UUID }>;
    const row = rows.find((r) => r.id === id);
    if (row) Object.assign(row, patch);
    emit();
  },
  remove<K extends keyof Database>(table: K, id: UUID) {
    (state[table] as unknown as { id: UUID }[]) = (state[table] as unknown as { id: UUID }[]).filter(
      (r) => r.id !== id
    );
    emit();
  },

  // ---- curriculum inbox ----
  addTopic(courseId: UUID, name: string, description: string) {
    const seq = state.topics.filter((t) => t.course_id === courseId).length + 1;
    const topic: Topic = {
      id: uid("t"), course_id: courseId, name, description, sequence_number: seq,
      status: "student_added", source_type: "student", source_reference: null, estimated_minutes: 60,
    };
    state.topics.push(topic);
    state.topic_mastery.push({
      id: uid("tm"), student_id: STUDENT_ID, topic_id: topic.id, mastery_score: 0,
      mastery_level: "not_started", confidence_score: 0, attempt_count: 0,
      last_practiced_at: null, last_assessed_at: null, next_review_at: null,
    });
    emit();
    return topic;
  },

  addSubtopic(topicId: UUID, name: string, description = "") {
    const seq = state.subtopics.filter((s) => s.topic_id === topicId).length + 1;
    state.subtopics.push({
      id: uid("s"), topic_id: topicId, name, description, sequence_number: seq, status: "active",
    });
    emit();
  },

  addLearningUnit(topicId: UUID, subtopicId: UUID | null, title: string, body: string, unit_type: import("./types").UnitType) {
    const seq = state.learning_units.filter((u) => u.topic_id === topicId).length + 1;
    state.learning_units.push({
      id: uid("lu"), topic_id: topicId, subtopic_id: subtopicId, title, unit_type,
      sequence_number: seq, description: body.slice(0, 120), body,
      estimated_minutes: 8, difficulty: 2, status: "approved",
    });
    emit();
  },

  // ---- study sessions / attempts ----
  startSession(session_type: StudySession["session_type"], topicId: UUID | null, note: string | null): UUID {
    const s: StudySession = {
      id: uid("sess"), student_id: STUDENT_ID, started_at: new Date().toISOString(),
      ended_at: null, duration_seconds: null, session_type, topic_id: topicId, note,
    };
    state.study_sessions.unshift(s);
    emit();
    return s.id;
  },
  endSession(sessionId: UUID) {
    const s = state.study_sessions.find((x) => x.id === sessionId);
    if (!s || s.ended_at) return;
    s.ended_at = new Date().toISOString();
    s.duration_seconds = Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000);
    emit();
  },
  recordLearningAttempt(unitId: UUID, sessionId: UUID | null, percent: number) {
    const a: LearningAttempt = {
      id: uid("la"), student_id: STUDENT_ID, learning_unit_id: unitId, study_session_id: sessionId,
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      completion_percent: percent,
    };
    state.learning_attempts.unshift(a);
    const unit = state.learning_units.find((u) => u.id === unitId);
    if (unit) this.touchTopicMastery(unit.topic_id, percent, false);
    emit();
  },
  recordQuestionAttempt(qId: UUID, sessionId: UUID | null, answer: unknown, correct: boolean, seconds: number, confidence: number | null = null) {
    const a: QuestionAttempt = {
      id: uid("qa"), student_id: STUDENT_ID, question_id: qId, study_session_id: sessionId,
      answer, is_correct: correct, score: correct ? 100 : 0, time_seconds: seconds,
      confidence, hints_used: 0, attempted_at: new Date().toISOString(),
    };
    state.question_attempts.unshift(a);
    const q = state.questions.find((x) => x.id === qId);
    if (q) this.touchTopicMastery(q.topic_id, correct ? 100 : 30, true);
    emit();
  },

  // ---- mastery + spaced repetition (SM-2 inspired) ----
  touchTopicMastery(topicId: UUID, performance: number, assessed: boolean) {
    const m = state.topic_mastery.find(
      (x) => x.student_id === STUDENT_ID && x.topic_id === topicId
    );
    if (!m) return;
    const prev = m.mastery_score;
    // Exponential moving average, faster gains on strong performance.
    const next = Math.max(0, Math.min(100, Math.round(prev * 0.7 + performance * 0.3)));
    m.mastery_score = next;
    m.mastery_level = levelForScore(next);
    m.confidence_score = Math.max(0, Math.min(100, Math.round(m.confidence_score * 0.6 + (performance - 10) * 0.4)));
    m.attempt_count += 1;
    m.last_practiced_at = new Date().toISOString();
    if (assessed) m.last_assessed_at = m.last_practiced_at;

    // Schedule / update review.
    let rev = state.review_schedule.find(
      (r) => r.student_id === STUDENT_ID && r.topic_id === topicId && r.status === "scheduled"
    );
    if (!rev) {
      rev = {
        id: uid("rev"), student_id: STUDENT_ID, topic_id: topicId,
        scheduled_for: new Date().toISOString(), interval_days: 1, ease_factor: 2.5,
        status: "scheduled", last_result: null,
      };
      state.review_schedule.push(rev);
    }
    const quality = performance >= 80 ? 5 : performance >= 60 ? 4 : performance >= 40 ? 3 : 2;
    rev.ease_factor = Math.max(1.3, rev.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
    if (quality < 3) {
      rev.interval_days = 1;
    } else {
      rev.interval_days = rev.interval_days === 1 ? 2 : Math.round(rev.interval_days * rev.ease_factor);
    }
    rev.last_result = performance;
    rev.scheduled_for = new Date(Date.now() + rev.interval_days * 86400000).toISOString();
    m.next_review_at = rev.scheduled_for;

    // Roll up skill mastery for the topic's skills.
    const skills = state.topic_skills.filter((ts) => ts.topic_id === topicId);
    skills.forEach((ts) => {
      let sm = state.skill_mastery.find(
        (x) => x.student_id === STUDENT_ID && x.skill_id === ts.skill_id
      );
      if (!sm) {
        sm = { id: uid("sm"), student_id: STUDENT_ID, skill_id: ts.skill_id, mastery_score: 0, confidence_score: 0, attempt_count: 0, last_assessed_at: null };
        state.skill_mastery.push(sm);
      }
      sm.mastery_score = Math.round(sm.mastery_score * 0.7 + performance * 0.3 * ts.importance);
      sm.confidence_score = Math.round(sm.confidence_score * 0.6 + (performance - 10) * 0.4);
      sm.attempt_count += 1;
      sm.last_assessed_at = new Date().toISOString();
    });
  },

  completeReview(reviewId: UUID) {
    const r = state.review_schedule.find((x) => x.id === reviewId);
    if (!r) return;
    r.status = "completed";
    emit();
  },

  // ---- recommendations ----
  actOnRecommendation(recId: UUID) {
    this.update("recommendations", recId, { status: "accepted" });
  },
  dismissRecommendation(recId: UUID) {
    this.update("recommendations", recId, { status: "dismissed" });
  },

  // ---- study plan ----
  togglePlanItem(itemId: UUID) {
    const item = state.study_plan_items.find((i) => i.id === itemId);
    if (!item) return;
    item.status = item.status === "completed" ? "planned" : "completed";
    emit();
  },

  // ---- uploads (simulated) ----
  uploadMaterial(file: File, courseId: UUID | null, topicId: UUID | null) {
    const reader = new FileReader();
    const id = uid("um");
    state.uploaded_materials.unshift({
      id, student_id: STUDENT_ID, course_id: courseId, topic_id: topicId, file_name: file.name,
      storage_path: `${STUDENT_ID}/${file.name}`, mime_type: file.type || "application/octet-stream",
      file_size: file.size, processing_status: "processing", extracted_text: null,
      ai_classification: null, created_at: new Date().toISOString(),
    });
    emit();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result.slice(0, 4000) : null;
      const lower = (text ?? file.name).toLowerCase();
      const course = courseId ? state.courses.find((c) => c.id === courseId) : null;
      const guess =
        lower.includes("calculus") || lower.includes("derivativ") ? "Derivatives"
        : lower.includes("newton") || lower.includes("force") ? "Newton's Laws of Motion"
        : lower.includes("cell") ? "Cell Structure and Function"
        : lower.includes("search") || lower.includes("algorithm") ? "Search and Problem Solving"
        : course ? `${course.name} material` : "General study material";
      const row = state.uploaded_materials.find((m) => m.id === id);
      if (row) {
        row.processing_status = "ready";
        row.extracted_text = text ?? "Text extraction not available for this file type.";
        row.ai_classification = { suggested_topic: guess, confidence: 0.86, course: course?.name ?? null };
        emit();
      }
    };
    reader.onerror = () => {
      const row = state.uploaded_materials.find((m) => m.id === id);
      if (row) { row.processing_status = "failed"; emit(); }
    };
    if (file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name)) reader.readAsText(file);
    else setTimeout(reader.onload as () => void, 900);
  },

  // ---- AI conversations ----
  startConversation(courseId: UUID | null, topicId: UUID | null, mode: AIConversation["mode"], title: string): UUID {
    const conv: AIConversation = {
      id: uid("conv"), student_id: STUDENT_ID, course_id: courseId, topic_id: topicId,
      mode, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    state.ai_conversations.unshift(conv);
    emit();
    return conv.id;
  },
  sendMessage(conversationId: UUID, content: string): AIMessage {
    const conv = state.ai_conversations.find((c) => c.id === conversationId)!;
    const userMsg: AIMessage = {
      id: uid("msg"), conversation_id: conversationId, role: "user", content,
      metadata: {}, created_at: new Date().toISOString(),
    };
    state.ai_messages.push(userMsg);
    conv.updated_at = userMsg.created_at;
    const reply = generateReply(content, conv, state);
    const aiMsg: AIMessage = {
      id: uid("msg"), conversation_id: conversationId, role: "assistant", content: reply,
      metadata: {}, created_at: new Date().toISOString(),
    };
    state.ai_messages.push(aiMsg);
    conv.updated_at = aiMsg.created_at;
    emit();
    return aiMsg;
  },
};

function levelForScore(s: number): MasteryLevel {
  if (s >= 90) return "mastered";
  if (s >= 75) return "strong";
  if (s >= 55) return "functional";
  if (s >= 35) return "developing";
  if (s > 0) return "learning";
  return "not_started";
}

// ---- deterministic, context-aware "AI" tutor (no external API needed) ----
function generateReply(question: string, conv: AIConversation, db: Database): string {
  const q = question.toLowerCase().trim();
  const topic = conv.topic_id ? db.topics.find((t) => t.id === conv.topic_id) : null;
  const course = (conv.course_id ? db.courses.find((c) => c.id === conv.course_id) : null)
    ?? (topic ? db.courses.find((c) => c.id === topic.course_id) : null);
  const units = topic ? db.learning_units.filter((u) => u.topic_id === topic.id) : [];

  if (/^(hi|hello|hey|good (morning|afternoon|evening)|howdy)/.test(q)) {
    return `Hello! I'm your StudyLab tutor${course ? ` for ${course.name}` : ""}. Ask me to explain a concept, work through an example, or build a quick practice question. ${topic ? `We're currently looking at **${topic.name}**.` : ""}`;
  }
  if (q.includes("practice") || q.includes("quiz") || q.includes("question")) {
    const bank = topic ? db.questions.filter((x) => x.topic_id === topic.id) : db.questions;
    const pick = bank[Math.floor(Math.random() * bank.length)];
    if (pick) {
      const opts = db.question_options.filter((o) => o.question_id === pick.id);
      const optText = opts.length ? "\n" + opts.map((o) => `${o.option_key}. ${o.option_text}`).join("\n") : "";
      return `Here's a ${topic ? topic.name : "mixed"} question:\n\n**${pick.question_text}**${optText}\n\nTell me your answer and I'll give you feedback and an explanation.`;
    }
  }
  if (q.includes("explain") || q.includes("what is") || q.includes("define") || q.includes("help")) {
    if (units.length) {
      const u = units[0];
      return `Let's break this down. **${u.title}**\n\n${u.body}\n\nWant me to follow up with a worked example or a practice question?`;
    }
    if (topic) return `${topic.name}: ${topic.description} I can build learning units on this from your uploaded notes — try uploading material from the Materials tab.`;
    return "I can explain concepts from any of your courses. Open a course or topic first, or ask me something like 'explain derivatives'.";
  }
  if (q.includes("example") || q.includes("work")) {
    const worked = units.find((u) => u.unit_type === "worked_example") ?? units[0];
    if (worked) return `**Worked example — ${worked.title}**\n\n${worked.body}\n\nTry repeating the steps yourself, then ask me for a similar problem.`;
  }
  if (q.match(/[a-d]\)?$/) || q.includes("answer is") || q.includes("i think")) {
    const bank = topic ? db.questions.filter((x) => x.topic_id === topic.id) : [];
    if (bank.length) {
      return "Noted. For a precise check, head to the Practice tab where answers are graded and feed into your mastery score. Keep going — active recall is what builds retention.";
    }
  }
  if (q.includes("review") || q.includes("mastery")) {
    const due = db.review_schedule.filter((r) => r.student_id === conv.student_id && r.status === "scheduled").length;
    return `You have ${due} topic${due === 1 ? "" : "s"} scheduled for review right now. Short, frequent review sessions use spaced repetition to lock in what you've learned — open the Review tab to start.`;
  }
  // Contextual fallback grounded in topic.
  if (topic) {
    const firstUnit = units[0];
    const focus = firstUnit ? firstUnit.title.toLowerCase() : "the core concept";
    const detail = firstUnit?.body?.slice(0, 220) ?? topic.description ?? "";
    return `Good question. For **${topic.name}**, focus on ${focus}: ${detail} Want me to turn this into a 3-question practice set?`;
  }
  return "I can help you explain concepts, work examples, generate practice questions and plan review. Try asking: \"explain Newton's laws\" or \"give me a practice question\".";
}

// ---- React hook ----
export function useStore<T>(selector: (db: Database) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(state),
    () => selector(state)
  );
}

export { levelForScore };
