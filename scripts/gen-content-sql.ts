import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import seed from "../src/seed";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NAMESPACE = "91461865-8a7e-4a3b-9c2d-5e8f1a2b3c4d";

/** Deterministic UUID v5 so FKs are stable across re-runs. */
function uuidv5(name: string): string {
  const nst = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(Buffer.concat([nst, Buffer.from(name)])).digest();
  const u = hash.subarray(0, 16);
  u[6] = (u[6] & 0x0f) | 0x50;
  u[8] = (u[8] & 0x3f) | 0x80;
  const h = u.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

const q = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
const j = (v: unknown): string => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const col = (arr: string[]) => `(${arr.join(", ")})`;
const valRow = (arr: string[]) => `  (${arr.join(", ")})`;

const out: string[] = [];
out.push("-- StudyLab 0003 — curriculum content seed.");
out.push("-- Inserts topics, subtopics, skills, learning units, resources, questions,");
out.push("-- practicals and course offerings for the LUANAR BSc NAS programme.");
out.push("-- Re-runnable: uses deterministic UUIDs and ON CONFLICT DO NOTHING.");
out.push("-- Apply AFTER 0001 and 0002.");
out.push("");
out.push("-- Course offerings (one per course in the active Year 2 Semester 1 period).");
out.push(`insert into public.course_offerings (id, course_id, academic_period_id, lecturer_name, status)`);
out.push(`select gen_random_uuid(), c.id, ap.id, null, 'active'`);
out.push(`from public.courses c`);
out.push(`join public.academic_periods ap on ap.programme_id = c.programme_id and ap.year_level = 2 and ap.semester = 1`);
out.push(`where c.status = 'confirmed'`);
out.push(`on conflict do nothing;`);
out.push("");

// Map old IDs to deterministic UUIDs.
const nasCourseIds = new Set(seed.courses.filter((c) => c.programme_id === "prog-nas").map((c) => c.id));
const nasTopics = seed.topics.filter((t) => nasCourseIds.has(t.course_id));
const nasTopicIds = new Set(nasTopics.map((t) => t.id));

const idFor = {
  topic: (id: string) => uuidv5("topic:" + id),
  sub: (id: string) => uuidv5("sub:" + id),
  unit: (id: string) => uuidv5("unit:" + id),
  res: (id: string) => uuidv5("res:" + id),
  q: (id: string) => uuidv5("q:" + id),
  opt: (id: string) => uuidv5("opt:" + id),
  pract: (id: string) => uuidv5("pract:" + id),
  step: (id: string) => uuidv5("step:" + id),
  skill: (id: string) => uuidv5("skill:" + id),
};

// Skills referenced by NAS topics.
const usedSkillIds = new Set<string>();
seed.topic_skills.filter((ts) => nasTopicIds.has(ts.topic_id)).forEach((ts) => usedSkillIds.add(ts.skill_id));
const skills = seed.skills.filter((s) => usedSkillIds.has(s.id));

out.push("-- Skills");
out.push("insert into public.skills (id, name, description, skill_type, created_by) values");
out.push(skills.map((s) => valRow([q(idFor.skill(s.id)), q(s.name), q(s.description), q(s.skill_type), "null"])).join(",\n") + " on conflict (id) do nothing;");
out.push("");

// Topics (course_id looked up by code).
out.push("-- Topics");
out.push("insert into public.topics (id, course_id, name, description, sequence_number, status, source_type, source_reference, estimated_minutes, created_by)");
out.push("values");
out.push(nasTopics.map((t) => {
  const course = seed.courses.find((c) => c.id === t.course_id)!;
  return valRow([
    q(idFor.topic(t.id)),
    `(select id from public.courses where code = ${q(course.code)} limit 1)`,
    q(t.name), q(t.description), q(t.sequence_number), q(t.status), q(t.source_type), q(t.source_reference), q(t.estimated_minutes), "null",
  ]);
}).join(",\n") + " on conflict (id) do nothing;");
out.push("");

// Subtopics.
const subs = seed.subtopics.filter((s) => nasTopicIds.has(s.topic_id));
out.push("-- Subtopics");
out.push("insert into public.subtopics (id, topic_id, name, description, sequence_number, status, created_by) values");
out.push(subs.map((s) => valRow([q(idFor.sub(s.id)), q(idFor.topic(s.topic_id)), q(s.name), q(s.description), q(s.sequence_number), q(s.status), "null"])).join(",\n") + " on conflict (id) do nothing;");
out.push("");

// Topic <-> skills.
const tskills = seed.topic_skills.filter((ts) => nasTopicIds.has(ts.topic_id));
out.push("-- Topic skills");
out.push("insert into public.topic_skills (topic_id, skill_id, importance) values");
out.push(tskills.map((ts) => valRow([q(idFor.topic(ts.topic_id)), q(idFor.skill(ts.skill_id)), q(ts.importance)])).join(",\n") + " on conflict on constraint topic_skills_pkey do nothing;");
out.push("");

// Learning units.
const units = seed.learning_units.filter((u) => nasTopicIds.has(u.topic_id));
out.push("-- Learning units");
out.push("insert into public.learning_units (id, topic_id, subtopic_id, title, unit_type, sequence_number, description, body, estimated_minutes, difficulty, status, created_by) values");
out.push(units.map((u) => valRow([
  q(idFor.unit(u.id)), q(idFor.topic(u.topic_id)),
  u.subtopic_id ? q(idFor.sub(u.subtopic_id)) : "null",
  q(u.title), q(u.unit_type), q(u.sequence_number), q(u.description), q(u.body),
  q(u.estimated_minutes), q(u.difficulty), q(u.status), "null",
])).join(",\n") + " on conflict (id) do nothing;");
out.push("");

// Content resources + links.
const resLinks = seed.topic_resources.filter((tr) => nasTopicIds.has(tr.topic_id));
const resIds = new Set(resLinks.map((r) => r.resource_id));
const resources = seed.content_resources.filter((r) => resIds.has(r.id));
out.push("-- Content resources");
out.push("insert into public.content_resources (id, title, description, resource_type, url, provider, author, duration_seconds, difficulty, status, source_type, created_by) values");
out.push(resources.map((r) => valRow([
  q(idFor.res(r.id)), q(r.title), q(r.description), q(r.resource_type), q(r.url), q(r.provider), q(r.author),
  q(r.duration_seconds), q(r.difficulty), q(r.status), q(r.source_type), "null",
])).join(",\n") + " on conflict (id) do nothing;");
out.push("");
out.push("-- Topic <-> resources");
out.push("insert into public.topic_resources (topic_id, resource_id, relationship_type, sequence_number) values");
out.push(resLinks.map((r) => valRow([q(idFor.topic(r.topic_id)), q(idFor.res(r.resource_id)), q(r.relationship_type), q(r.sequence_number)])).join(",\n") + " on conflict on constraint topic_resources_pkey do nothing;");
out.push("");

// Questions + options.
const questions = seed.questions.filter((qq) => nasTopicIds.has(qq.topic_id));
const qIds = new Set(questions.map((x) => x.id));
out.push("-- Questions");
out.push("insert into public.questions (id, topic_id, subtopic_id, question_type, difficulty, question_text, explanation, hint_1, hint_2, correct_answer, estimated_seconds, status, created_by) values");
out.push(questions.map((qq) => valRow([
  q(idFor.q(qq.id)), q(idFor.topic(qq.topic_id)),
  qq.subtopic_id ? q(idFor.sub(qq.subtopic_id)) : "null",
  q(qq.question_type), q(qq.difficulty), q(qq.question_text), q(qq.explanation), q(qq.hint_1), q(qq.hint_2),
  j(qq.correct_answer), q(qq.estimated_seconds), q(qq.status), "null",
])).join(",\n") + " on conflict (id) do nothing;");
out.push("");
const opts = seed.question_options.filter((o) => qIds.has(o.question_id));
out.push("-- Question options");
out.push("insert into public.question_options (id, question_id, option_key, option_text, sequence_number, created_by) values");
out.push(opts.map((o) => valRow([q(idFor.opt(o.id)), q(idFor.q(o.question_id)), q(o.option_key), q(o.option_text), q(o.sequence_number), "null"])).join(",\n") + " on conflict (id) do nothing;");
out.push("");

// Practicals + steps.
const practicals = seed.practicals.filter((p) => nasTopicIds.has(p.topic_id));
const pIds = new Set(practicals.map((p) => p.id));
out.push("-- Practicals");
out.push("insert into public.practicals (id, topic_id, title, objective, background, materials, safety_notes, expected_outcome, assessment_notes, status, created_by) values");
out.push(practicals.map((p) => valRow([
  q(idFor.pract(p.id)), q(idFor.topic(p.topic_id)), q(p.title), q(p.objective), q(p.background),
  j(p.materials), q(p.safety_notes), q(p.expected_outcome), q(p.assessment_notes), q(p.status), "null",
])).join(",\n") + " on conflict (id) do nothing;");
out.push("");
const steps = seed.practical_steps.filter((s) => pIds.has(s.practical_id));
out.push("-- Practical steps");
out.push("insert into public.practical_steps (id, practical_id, step_number, instruction, expected_action, observation_prompt, created_by) values");
out.push(steps.map((s) => valRow([q(idFor.step(s.id)), q(idFor.pract(s.practical_id)), q(s.step_number), q(s.instruction), q(s.expected_action), q(s.observation_prompt), "null"])).join(",\n") + " on conflict (id) do nothing;");
out.push("");

out.push("-- Helpful indexes for the seeded content.");
out.push("create index if not exists idx_seed_topics_course_seq on public.topics(course_id, sequence_number);");
out.push("analyze public.topics, public.learning_units, public.questions;");
out.push("");

const target = path.resolve(__dirname, "..", "supabase", "migrations", "0003_seed_curriculum_content.sql");
fs.writeFileSync(target, out.join("\n"));
console.log(`Wrote ${target} (${nasTopics.length} topics, ${units.length} units, ${questions.length} questions, ${practicals.length} practicals, ${resources.length} resources)`);
