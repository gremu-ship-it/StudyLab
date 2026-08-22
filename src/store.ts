import { useSyncExternalStore } from "react";
import seed, { provisionStudentProgramme } from "./seed";
import type {
  AIMessage, AIConversation, ContentResource, Database, LearningAttempt, MasteryLevel,
  QuestionAttempt, ReviewSchedule, StudySession, Topic, UUID,
} from "./types";

const STORAGE_KEY = "studylab.db.v2";
const DEMO_STUDENT_ID = "student-1";
let currentStudentId = DEMO_STUDENT_ID;

type Listener = () => void;

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const TABLE_KEYS: (keyof Database)[] = [
  "institutions", "programmes", "academic_periods", "courses", "course_offerings",
  "topics", "subtopics", "skills", "topic_skills", "learning_units",
  "content_resources", "topic_resources", "questions", "question_options",
  "practicals", "practical_steps", "student_profiles", "enrolments",
  "student_course_enrolments", "study_sessions", "learning_attempts",
  "question_attempts", "topic_mastery", "skill_mastery", "review_schedule",
  "recommendations", "study_plans", "study_plan_items", "uploaded_materials",
  "ai_conversations", "ai_messages",
];

function load(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Database>;
      // Defensive: ensure every table array exists (older caches may lack new tables).
      for (const k of TABLE_KEYS) {
        if (!Array.isArray(parsed[k])) (parsed as Record<string, unknown>)[k] = [];
      }
      return parsed as Database;
    }
  } catch {
    /* fall through to seed */
  }
  return deepClone(seed);
}

export type DataMode = "demo" | "live";

type RemoteHooks = {
  upsert?: (table: string, row: unknown) => Promise<string | null> | string | null;
  remove?: (table: string, id: string) => Promise<string | null> | string | null;
  uploadFile?: (userId: string, file: File) => Promise<{ path: string; error: string | null }>;
  onError?: (message: string) => void;
};

let state: Database = load();
let mode: DataMode = "demo";
let remote: RemoteHooks = {};
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

export const uid = (prefix = "id"): UUID => {
  // In live (Supabase) mode, primary keys are uuid columns, so generate valid UUIDs.
  if (mode === "live" && typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

/** Push a freshly created row to the configured remote (no-op in demo mode). */
function sync(table: string, row: unknown) {
  void Promise.resolve(remote.upsert?.(table, row)).then((err) => { if (err) remote.onError?.(`Could not save to cloud: ${err}`); });
}

export const store = {
  get: () => state,
  getMode: () => mode,
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Replace the entire in-memory database (used when hydrating from Supabase). */
  replace(next: Database, nextMode: DataMode = "live") {
    state = next;
    mode = nextMode;
    persist();
    emit();
  },
  setRemote(hooks: RemoteHooks) { remote = hooks; },
  setStudentId(id: string) { currentStudentId = id; },
  setMode(m: DataMode) { mode = m; emit(); },
  reset() {
    state = deepClone(seed);
    mode = "demo";
    currentStudentId = DEMO_STUDENT_ID;
    emit();
  },
  studentId: currentStudentId,

  // ---- generic helpers ----
  insert<K extends keyof Database>(table: K, row: Database[K][number]) {
    (state[table] as unknown[]).unshift(row as unknown);
    emit();
    void Promise.resolve(remote.upsert?.(table as string, row)).then((err) => { if (err) remote.onError?.(`Could not save to cloud: ${err}`); });
  },
  update<K extends keyof Database>(table: K, id: UUID, patch: Partial<Database[K][number]>) {
    const rows = state[table] as unknown as Array<{ id: UUID }>;
    const row = rows.find((r) => r.id === id);
    if (row) {
      Object.assign(row, patch);
      emit();
      void Promise.resolve(remote.upsert?.(table as string, row)).then((err) => { if (err) remote.onError?.(`Could not save to cloud: ${err}`); });
    }
  },
  remove<K extends keyof Database>(table: K, id: UUID) {
    (state[table] as unknown as { id: UUID }[]) = (state[table] as unknown as { id: UUID }[]).filter(
      (r) => r.id !== id
    );
    emit();
    void Promise.resolve(remote.remove?.(table as string, id)).then((err) => { if (err) remote.onError?.(`Could not delete from cloud: ${err}`); });
  },

  // ---- curriculum inbox ----
  addTopic(courseId: UUID, name: string, description: string) {
    const seq = state.topics.filter((t) => t.course_id === courseId).length + 1;
    const topic: Topic = {
      id: uid("t"), course_id: courseId, name, description, sequence_number: seq,
      status: "student_added", source_type: "student", source_reference: null, estimated_minutes: 60,
      created_by: mode === "live" ? currentStudentId : null,
    };
    state.topics.push(topic);
    const tm = {
      id: uid("tm"), student_id: currentStudentId, topic_id: topic.id, mastery_score: 0,
      mastery_level: "not_started" as const, confidence_score: 0, attempt_count: 0,
      last_practiced_at: null, last_assessed_at: null, next_review_at: null,
    };
    state.topic_mastery.push(tm);
    emit();
    sync("topics", topic);
    sync("topic_mastery", tm);
    return topic;
  },

  addSubtopic(topicId: UUID, name: string, description = "") {
    const seq = state.subtopics.filter((s) => s.topic_id === topicId).length + 1;
    const sub = {
      id: uid("s"), topic_id: topicId, name, description, sequence_number: seq, status: "active" as const,
      created_by: mode === "live" ? currentStudentId : null,
    };
    state.subtopics.push(sub);
    emit();
    sync("subtopics", sub);
  },

  addLearningUnit(topicId: UUID, subtopicId: UUID | null, title: string, body: string, unit_type: import("./types").UnitType) {
    const seq = state.learning_units.filter((u) => u.topic_id === topicId).length + 1;
    const lu = {
      id: uid("lu"), topic_id: topicId, subtopic_id: subtopicId, title, unit_type,
      sequence_number: seq, description: body.slice(0, 120), body,
      estimated_minutes: 8, difficulty: 2, status: "approved" as const,
      created_by: mode === "live" ? currentStudentId : null,
    };
    state.learning_units.push(lu);
    emit();
    sync("learning_units", lu);
  },

  // ---- study sessions / attempts ----
  startSession(session_type: StudySession["session_type"], topicId: UUID | null, note: string | null): UUID {
    const s: StudySession = {
      id: uid("sess"), student_id: currentStudentId, started_at: new Date().toISOString(),
      ended_at: null, duration_seconds: null, session_type, topic_id: topicId, note,
    };
    state.study_sessions.unshift(s);
    emit();
    sync("study_sessions", s);
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
      id: uid("la"), student_id: currentStudentId, learning_unit_id: unitId, study_session_id: sessionId,
      started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      completion_percent: percent,
    };
    state.learning_attempts.unshift(a);
    const unit = state.learning_units.find((u) => u.id === unitId);
    if (unit) this.touchTopicMastery(unit.topic_id, percent, false);
    emit();
    sync("learning_attempts", a);
  },
  recordQuestionAttempt(qId: UUID, sessionId: UUID | null, answer: unknown, correct: boolean, seconds: number, confidence: number | null = null) {
    const a: QuestionAttempt = {
      id: uid("qa"), student_id: currentStudentId, question_id: qId, study_session_id: sessionId,
      answer, is_correct: correct, score: correct ? 100 : 0, time_seconds: seconds,
      confidence, hints_used: 0, attempted_at: new Date().toISOString(),
    };
    state.question_attempts.unshift(a);
    const q = state.questions.find((x) => x.id === qId);
    if (q) this.touchTopicMastery(q.topic_id, correct ? 100 : 30, true);
    emit();
    sync("question_attempts", a);
  },

  // ---- mastery + spaced repetition (SM-2 inspired) ----
  touchTopicMastery(topicId: UUID, performance: number, assessed: boolean) {
    const m = state.topic_mastery.find(
      (x) => x.student_id === currentStudentId && x.topic_id === topicId
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
      (r) => r.student_id === currentStudentId && r.topic_id === topicId && r.status === "scheduled"
    );
    if (!rev) {
      rev = {
        id: uid("rev"), student_id: currentStudentId, topic_id: topicId,
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
        (x) => x.student_id === currentStudentId && x.skill_id === ts.skill_id
      );
      if (!sm) {
        sm = { id: uid("sm"), student_id: currentStudentId, skill_id: ts.skill_id, mastery_score: 0, confidence_score: 0, attempt_count: 0, last_assessed_at: null };
        state.skill_mastery.push(sm);
      }
      sm.mastery_score = Math.round(sm.mastery_score * 0.7 + performance * 0.3 * ts.importance);
      sm.confidence_score = Math.round(sm.confidence_score * 0.6 + (performance - 10) * 0.4);
      sm.attempt_count += 1;
      sm.last_assessed_at = new Date().toISOString();
      sync("skill_mastery", sm);
    });
    sync("topic_mastery", m);
    sync("review_schedule", rev);
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

  // ---- uploads (live: Supabase Storage; demo: local) ----
  async uploadMaterial(file: File, courseId: UUID | null, topicId: UUID | null) {
    const id = uid("um");
    let storagePath = `${currentStudentId}/${file.name}`;

    // In live mode, push the file to Supabase Storage first so the RLS folder
    // policy (folder = auth.uid()) is satisfied.
    if (mode === "live" && remote.uploadFile) {
      const { path, error } = await remote.uploadFile(currentStudentId, file);
      if (error) { remote.onError?.(`Upload failed: ${error}`); return; }
      storagePath = path;
    }

    const readText = (): Promise<string | null> =>
      new Promise((resolve) => {
        if (!(file.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(file.name))) return resolve(null);
        const r = new FileReader();
        r.onload = () => resolve(typeof r.result === "string" ? r.result.slice(0, 4000) : null);
        r.onerror = () => resolve(null);
        r.readAsText(file);
      });

    const upload = {
      id, student_id: currentStudentId, course_id: courseId, topic_id: topicId, file_name: file.name,
      storage_path: storagePath, mime_type: file.type || "application/octet-stream",
      file_size: file.size, processing_status: "processing" as const, extracted_text: null,
      ai_classification: null, created_at: new Date().toISOString(),
    };
    state.uploaded_materials.unshift(upload);
    emit();
    sync("uploaded_materials", upload);

    const text = await readText();
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
      row.extracted_text = text ?? (mode === "live"
        ? "File stored in StudyLab. Text extraction for PDFs/Office files runs in the processing pipeline."
        : "Text extraction not available for this file type.");
      row.ai_classification = { suggested_topic: guess, confidence: 0.86, course: course?.name ?? null };
      emit();
      sync("uploaded_materials", row);
    }
  },

  // ---- multi-institution / programme provisioning ----
  setupStudent(fullName: string, institutionId: UUID, programmeId: UUID, year: number, semester: 1 | 2) {
    let profile = state.student_profiles.find((s) => s.id === currentStudentId);
    if (!profile) {
      profile = {
        id: currentStudentId, full_name: fullName, institution_id: institutionId, programme_id: programmeId,
        current_year: year, current_semester: semester, timezone: "Africa/Blantyre",
        study_preferences: { daily_target_minutes: 60 },
      };
      state.student_profiles.push(profile);
      sync("student_profiles", profile);
    } else {
      profile.full_name = fullName;
      profile.institution_id = institutionId;
      profile.programme_id = programmeId;
      profile.current_year = year;
      profile.current_semester = semester;
      sync("student_profiles", profile);
    }
    // Make sure an active plan exists.
    let planId = state.study_plans.find((p) => p.student_id === currentStudentId && p.status === "active")?.id;
    if (!planId) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const plan = {
        id: uid("plan"), student_id: currentStudentId, name: "Today's adaptive plan",
        start_date: todayStr, end_date: todayStr, target_minutes: 45, status: "active" as const,
      };
      state.study_plans.push(plan);
      sync("study_plans", plan);
      planId = plan.id;
    }
    if (mode === "live") provisionLiveStudent(state, currentStudentId, programmeId, year, semester, planId);
    else provisionStudentProgramme(state, currentStudentId, programmeId, year, semester, planId);
    // Sync the student-owned rows that provisioning created.
    sync("enrolments", state.enrolments.find((e) => e.student_id === currentStudentId));
    state.student_course_enrolments.filter((e) => e.student_id === currentStudentId).forEach((r) => sync("student_course_enrolments", r));
    state.topic_mastery.filter((r) => r.student_id === currentStudentId).forEach((r) => sync("topic_mastery", r));
    state.review_schedule.filter((r) => r.student_id === currentStudentId).forEach((r) => sync("review_schedule", r));
    state.recommendations.filter((r) => r.student_id === currentStudentId).forEach((r) => sync("recommendations", r));
    state.study_plan_items.filter((r) => r.study_plan_id === planId).forEach((r) => sync("study_plan_items", r));
    state.study_sessions.filter((r) => r.student_id === currentStudentId).forEach((r) => sync("study_sessions", r));
    emit();
  },

  switchStudentProgramme(programmeId: UUID, year: number, semester: 1 | 2) {
    const profile = state.student_profiles.find((s) => s.id === currentStudentId);
    if (!profile) return;
    const programme = state.programmes.find((p) => p.id === programmeId);
    if (!programme) return;
    profile.programme_id = programmeId;
    profile.institution_id = programme.institution_id;
    profile.current_year = year;
    profile.current_semester = semester;
    let planId = state.study_plans.find((p) => p.student_id === currentStudentId && p.status === "active")?.id;
    if (!planId) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const plan = {
        id: uid("plan"), student_id: currentStudentId, name: "Today's adaptive plan",
        start_date: todayStr, end_date: todayStr, target_minutes: 45, status: "active" as const,
      };
      state.study_plans.push(plan);
      sync("study_plans", plan);
      planId = plan.id;
    }
    provisionStudentProgramme(state, currentStudentId, programmeId, year, semester, planId);
    sync("student_profiles", profile);
    sync("enrolments", state.enrolments.find((e) => e.student_id === currentStudentId));
    state.student_course_enrolments.filter((e) => e.student_id === currentStudentId).forEach((r) => sync("student_course_enrolments", r));
    state.topic_mastery.filter((r) => r.student_id === currentStudentId).forEach((r) => sync("topic_mastery", r));
    state.review_schedule.filter((r) => r.student_id === currentStudentId).forEach((r) => sync("review_schedule", r));
    state.recommendations.filter((r) => r.student_id === currentStudentId).forEach((r) => sync("recommendations", r));
    state.study_plan_items.filter((r) => r.study_plan_id === planId).forEach((r) => sync("study_plan_items", r));
    state.study_sessions.filter((r) => r.student_id === currentStudentId).forEach((r) => sync("study_sessions", r));
    emit();
  },

  addInstitution(name: string, shortName: string, country: string) {
    const inst = {
      id: uid("inst"), name, short_name: shortName || null, country: country || null,
      website_url: null, is_active: true,
    };
    state.institutions.push(inst);
    emit();
    sync("institutions", inst);
    return inst;
  },

  addProgramme(institutionId: UUID, name: string, code: string, description = "", durationYears = 4) {
    const prog = {
      id: uid("prog"), institution_id: institutionId, name, code: code || null,
      description: description || null, duration_years: durationYears, is_active: true,
    };
    state.programmes.push(prog);
    const year = new Date().getFullYear();
    const period = {
      id: uid("ap"), programme_id: prog.id, academic_year: year, year_level: 1, semester: 1 as 1 | 2,
      name: `Year 1 Semester 1`, start_date: `${year}-08-01`, end_date: `${year}-12-15`, status: "active" as const,
    };
    state.academic_periods.push(period);
    emit();
    sync("programmes", prog);
    sync("academic_periods", period);
    return prog;
  },

  addContentResource(topicId: UUID, title: string, url: string, resourceType: ContentResource["resource_type"]) {
    const resource: ContentResource = {
      id: uid("r"), title, description: null, resource_type: resourceType, url,
      provider: resourceType === "youtube" ? "YouTube" : null, author: null,
      duration_seconds: resourceType === "youtube" ? 600 : null, difficulty: 2,
      status: "active", source_type: "student",
      created_by: mode === "live" ? currentStudentId : null,
    };
    const seq = state.topic_resources.filter((tr) => tr.topic_id === topicId).length + 1;
    const link = { topic_id: topicId, resource_id: resource.id, relationship_type: "supports", sequence_number: seq };
    state.content_resources.push(resource);
    state.topic_resources.push(link);
    emit();
    sync("content_resources", resource);
    sync("topic_resources", link);
    return resource;
  },

  // ---- AI conversations ----
  startConversation(courseId: UUID | null, topicId: UUID | null, mode: AIConversation["mode"], title: string): UUID {
    const conv: AIConversation = {
      id: uid("conv"), student_id: currentStudentId, course_id: courseId, topic_id: topicId,
      mode, title, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    state.ai_conversations.unshift(conv);
    emit();
    sync("ai_conversations", conv);
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
    sync("ai_messages", userMsg);
    sync("ai_messages", aiMsg);
    sync("ai_conversations", conv);
    return aiMsg;
  },
};

/**
 * Provision student-owned rows in LIVE mode using only IDs that already exist
 * in the (hydrated) database — enrolment + course enrolments against real
 * offerings, empty mastery/review/plan rows. Curriculum (topics, units,
 * questions) comes from the shared DB content, not fake local IDs.
 */
function provisionLiveStudent(
  db: Database, studentId: string, programmeId: string, year: number, semester: 1 | 2, planId: string
) {
  const period = db.academic_periods.find((p) => p.programme_id === programmeId && p.year_level === year && p.semester === semester && p.status === "active")
    ?? db.academic_periods.find((p) => p.programme_id === programmeId && p.status === "active");
  if (!period) return;

  if (!db.enrolments.some((e) => e.student_id === studentId && e.programme_id === programmeId)) {
    db.enrolments.push({
      id: uid("enr"), student_id: studentId, programme_id: programmeId, academic_period_id: period.id,
      status: "active", started_at: new Date().toISOString(), ended_at: null,
    });
  }
  const offerings = db.course_offerings.filter((o) => o.academic_period_id === period.id);
  offerings.forEach((o) => {
    if (!db.student_course_enrolments.some((e) => e.student_id === studentId && e.course_offering_id === o.id)) {
      db.student_course_enrolments.push({ id: uid("sce"), student_id: studentId, course_offering_id: o.id, status: "active" });
    }
  });

  // Seed a small daily plan from the first available topics.
  const courseIds = new Set(db.courses.filter((c) => c.programme_id === programmeId).map((c) => c.id));
  const topics = db.topics.filter((t) => courseIds.has(t.course_id)).slice(0, 4);
  const labels = ["quick revision", "practice set", "worked problems", "overview"];
  topics.forEach((t, i) => {
    if (db.study_plan_items.some((it) => it.study_plan_id === planId && it.topic_id === t.id)) return;
    db.study_plan_items.push({
      id: uid("spi"), study_plan_id: planId, topic_id: t.id,
      title: `${t.name} — ${labels[i] ?? "study"}`, scheduled_date: new Date().toISOString().slice(0, 10),
      planned_minutes: [10, 15, 15, 5][i] ?? 10, sequence_number: i + 1, status: "planned",
    });
  });
}

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
