# StudyLab — Architecture Assessment & Evolution Plan

Status: **v0.2 plan** (2026-08-24)
Scope: evolve the StudyLab MVP (React 19 + TS + Vite, Supabase) into an AI-powered university learning environment without discarding the existing architecture.

---

## 1. Current architecture assessment

**Frontend**
- Single-page React 19 + Vite + TypeScript app. One file (`src/App.tsx`) renders four views (Dashboard, My Courses, Study Plan, Curriculum Inbox) plus modals.
- `src/data.ts` contains **hard-coded demo data** (14 LUANAR courses, 3 canned recommendations) and `src/types.ts` its types. Nothing is persisted on write: "Add topic" only fires an `alert()`.
- `src/lib/supabase.ts` creates a client only when `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are set; **it is never used by the UI** — the app has no auth, no data access layer, and no error/empty states for the connected case.
- Styling is a single hand-written `styles.css` (no framework). The design system (sidebar, cards, hero, modal, progress bars) is already in place and worth keeping.

**Database (migration `0001_studylab_v0_1.sql`)**
- A genuinely solid relational foundation: institutions → programmes → academic periods → courses → course offerings; topics → subtopics; skills; learning units; content resources ↔ topic links; questions + options; practicals + steps; student profiles, enrolments, study sessions, learning/question attempts, topic & skill mastery, review schedule (SM-2 fields already present), recommendations, study plans, uploaded materials, AI conversations/messages, topic relationships (prerequisite/supports/builds_on), curriculum sources.
- RLS is enabled on all 33 public tables; student-owned tables are scoped to `auth.uid()`, curriculum tables are read-only to authenticated users, and a private `student-materials` bucket is provisioned.
- **Defect found during verification:** the seed `insert into institutions ... on conflict (name)` failed because `institutions.name` had no unique constraint — migration 0001 could not complete on a fresh project. Fixed in place (unique constraint + defensive backfill). Verified with a local embedded-PostgreSQL harness (`scripts/local-db.mjs`).

**What the app is today vs. the product vision**

| Vision requirement | Current state |
|---|---|
| DISCOVER → … → MASTER loop | No learning flow at all; static course cards |
| Learning Sessions as first-class object | Only `learning_units` blocks exist (no session instance, no steps, no unlock logic) |
| Concepts / objectives / mastery per concept | Mastery is per topic/skill only; no `concepts`, no `learning_objectives` |
| Source hierarchy (L1–L4) + provenance | No `source_level`; resources are not linked to concepts; uploads have no extraction |
| Active-learning scaffolding (hints, guiding Qs, reveal) | `questions` have `hint_1/hint_2` only; no scaffolding loop in UI |
| Assessment (multiple types, attempts, scoring) | Question rows exist; no assessment bundles, no attempt UI, no `assessment_attempts` |
| Recommendations with reasons | Static demo cards; `recommendations` table exists but is never written |
| Knowledge map | Nothing |
| AI tutor | Table exists; no Edge Function, no context builder |
| Practical activities | `practicals`/`practical_steps` schema exists; no runner, no subject activity types |
| Auth / onboarding | Not implemented in UI (RLS assumes it) |

## 2. Existing components that can be reused

- **`supabase/migrations/0001_*`** — keep as the base layer. All tables above remain; we extend, not replace.
- **RLS pattern** (`student_id = auth.uid()` ownership + authenticated read for curriculum + private bucket policies) — reused for every new table.
- **UI shell** — sidebar/topbar layout, card & modal styles, empty-state component, progress bar, responsive breakpoints. Restyled, not rebuilt.
- **`learning_units`** — becomes the content block type used inside sessions (explanation / definition / example / worked example / practice / reflection / review / practical).
- **`questions`, `question_options`** — become the practice/assessment engine's content.
- **`practicals`, `practical_steps`** — become the practical-learning runner.
- **`topic_relationships`** — powers prerequisite checks in the recommendation engine and knowledge map.
- **`review_schedule`** (SM-2 fields: `interval_days`, `ease_factor`) — reused as-is by the mastery/review engine.
- **`study_sessions`, `question_attempts`, `learning_attempts`** — event backbone for mastery estimation; extended, not replaced.
- **LUANAR seed data** (institution, programme, 15 courses) — kept; topics intentionally enter via the curriculum inbox/materials flow, not by inventing syllabus.

## 3. Missing components

1. **Learning Session system** — `learning_sessions`, `learning_session_steps`, step types, unlock rules, session runner UI, resume-where-you-stopped.
2. **Knowledge model** — `concepts`, `concept_prerequisites`, `learning_objectives`, `concept_mastery`, concept-level links on questions/resources/units.
3. **Auth + onboarding** — sign-in/sign-up, `student_profiles` upsert, programme/period enrolment selection.
4. **Data access layer** — `src/lib/api.ts` (typed queries), `useQuery` hook, loading/error/empty states; removal of `src/data.ts` demo data.
5. **Source management** — `source_level` (1 student/lecturer/university material · 2 authoritative academic · 3 curated video/external · 4 AI-generated), `provenance` metadata, `extracted_content` from uploads, resource↔concept links.
6. **Document ingestion pipeline** — storage upload (exists) → text extraction → structural parse (headings, definitions, formulas, questions, objectives, activities) → association with topic → session generation.
7. **Active-learning engine** — deterministic answer checking (all question types) + scaffolded problem-solving state machine (attempt → hint → guiding question → partial help → reveal → why → similar problem).
8. **Assessment engine** — `assessments` bundles, `assessment_attempts`, results with per-question detail.
9. **Mastery engine** — concept/topic/course/programme aggregation, level classification (not assessed / weak / developing / strong / mastered), easy-vs-application discrimination, SM-2 review scheduling.
10. **Recommendation engine** — rule-based, explains *why* (prerequisite gaps, weak application, review due, readiness for next difficulty).
11. **AI tutor** — server-side Edge Function, context builder (programme → course → topic → session → attempts → mastery), Feynman/explain-back mode, source-labelled answers, honest "not enough source material" behaviour.
12. **Practical learning** — practical runner + extensible activity-type registry (deterministic built-ins first: equation balancing, break-even, graph/derivative interpretation).
13. **Knowledge map** — visual course → topic → concept → skill with mastery colours.
14. **Testing** — vitest for all pure engines (session, mastery, answer checking, recommendations).

## 4. Database changes required (incremental migrations)

All changes keep strong relational integrity (FKs, checks, unique constraints) and RLS. Each migration is verified against embedded PostgreSQL before merge.

| Migration | Phase | Contents |
|---|---|---|
| `0002_learning_sessions.sql` | 1 | `concepts`, `concept_prerequisites`, `learning_objectives`, `learning_sessions`, `learning_session_steps`; extend `learning_units` (body, formula, media, source fields, created_by), `questions` (concept/skill/objective links, `is_diagnostic`, `scaffolding` jsonb), `topics` (created_by); student-write policies for student-authored curriculum; indexes |
| `0003_sources_provenance.sql` | 2–3 | `source_level` (1–4) + `provenance` jsonb on resources/units/questions; `resource_concepts`; extend `uploaded_materials` (hash, page count, error); `extracted_content` with item types + confidence + concept/question links |
| `0004_assessments_mastery.sql` | 5–6 | `assessments`, `assessment_attempts` (per-question results jsonb), `concept_mastery`; `question_attempts` extended (session link, attempt number) |
| `0005_ai_reflection.sql` | 8 | `explain_back_attempts` (Feynman mode); AI conversation modes extended |

Storage: reuse the existing private `student-materials` bucket; files live under `{user_id}/...` (RLS already enforces).

## 5. API / service changes

No separate backend is introduced — Supabase Postgres (PostgREST via client) remains the API for all CRUD, plus two **Edge Functions** (server-side; secrets never reach the browser):

- `supabase/functions/ai-tutor` — takes a structured context payload (programme, course, topic, session, concept, attempt history, mastery snapshot) + user messages; returns content with explicit **source labels** ("Based on your course material" / "Supplementary academic explanation" / "AI-generated explanation" / "External resource") and a `needs_more_info` flag. Providers: Anthropic or OpenAI via `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`. Returns structured 503 `ai_not_configured` when absent — the UI surfaces that honestly instead of faking answers.
- `supabase/functions/process-material` — reads the uploaded object (service role), extracts text (`.txt`/`.md` fully supported now; PDF extraction explicitly marked **pending**), runs a deterministic structural parser (headings, definitions, formulas, numbered problems, objectives), writes `extracted_content` rows, updates `uploaded_materials.processing_status`.

Client-side service layer (`src/lib/api.ts`) owns all queries/mutations; pure engines (`session`, `mastery`, `answer`, `recommendations`) run in the browser and are unit-tested.

## 6. UI changes

Replace the single-file `App.tsx` with a small page/component structure (no framework dependencies added):

```
App.tsx            shell + hash router + auth gate
router.tsx         tiny hash router (Link, useRoute)
pages/
  Setup.tsx        shown when VITE_SUPABASE_* is missing (honest unconfigured state)
  AuthPage.tsx     sign in / up + programme onboarding
  Dashboard.tsx    TODAY'S PLAN · CONTINUE LEARNING · WEAK AREAS · UPCOMING · REVIEW DUE · RECOMMENDATIONS
  Courses.tsx      programme courses (live data)
  CourseWorkspace  Overview · Topics · Resources · Practice · Assessments · Practicals · Mastery · Map
  TopicDetail.tsx  objectives, prerequisites, resources, materials, launch Learning Session
  SessionRunner.tsx step-by-step session with progressive unlock + scaffolded questions
  Materials.tsx    upload, extraction status, extracted content with provenance
  KnowledgeMap.tsx SVG course→topic→concept map, mastery colours
  Tutor.tsx        contextual AI tutor + Feynman (explain-back) mode
components/ui.tsx  Button, Card, Badge, Modal, Tabs, Progress, Empty, Field (reuse MVP styles)
components/QuestionRunner.tsx  scaffolded problem-solving loop (shared by practice/assessment/session)
```

Principles applied: one obvious next action per screen; locked steps visible but not actionable; every generated item shows its source badge (L1–L4); pending integrations are labelled "pending", never faked.

## 7. AI architecture

- **Server-side only.** Browser calls `supabase.functions.invoke("ai-tutor")`; the API key lives in Edge Function secrets.
- **Context builder (client, pure):** assembles a compact JSON context: programme/year/semester, course, topic, subtopic, current session + current step, concept, last diagnostic result, recent attempts (question id, correctness, hints used), mastery levels, known weak concepts, relevant source excerpts (student material first, then L2, then L3; AI text is explicitly marked L4).
- **System policy (in the function):** never present AI text as authoritative; prefer L1–L3 content; if sources are insufficient, respond with `needs_more_info: true` and say what is missing; adapt difficulty to demonstrated mastery; scaffold (hints before answers).
- **Modes:** tutor Q&A, explain-simply, analogy, example, math reasoning, practical example, quiz, hint, why-wrong, teach-from-beginning, test-my-understanding, Feynman evaluation (scores conceptual correctness, missing ideas, misconceptions, clarity, application).
- **No fake AI:** if no provider key is configured, the tutor page shows the configured context panel and a clear "AI provider not configured — set ANTHROPIC_API_KEY / OPENAI_API_KEY on the Edge Function" notice. Deterministic features (quiz from question bank, scaffolding, mastery, recommendations) work without any AI.

## 8. Implementation phases

| # | Phase | Core deliverables | Verification gate |
|---|---|---|---|
| 1 | Learning Session foundation | 0002; concepts/objectives/sessions/step model; `lib/session.ts` unlock logic; answer checking; auth+shell+router; SessionRunner | build + unit tests + migration/RLS verify + app runs |
| 2 | Course/topic/resource integration | 0003; CourseWorkspace tabs; add topic/subtopic/objective; prerequisites; live dashboard | same gate + regression of phase 1 flows |
| 3 | Document upload & source management | Materials page; storage upload; process-material function; extracted_content display with provenance; source levels | same gate + RLS on extracted content |
| 4 | Lesson generation from sources | deterministic session builder from topic material/units; ai-tutor function; honest pending states | same gate |
| 5 | Practice & assessment engine | practice tab; scaffolded QuestionRunner; assessments create/attempt/results | same gate + answer-engine tests |
| 6 | Mastery engine | concept_mastery; SM-2 scheduling; weak-area & application-gap detection | same gate + mastery tests |
| 7 | Adaptive recommendations | rule engine → recommendations rows with reasons; dashboard "why" | same gate + recommendation tests |
| 8 | AI Tutor | context builder; tutor page; Feynman mode; ai_not_configured path | same gate |
| 9 | Practical learning | practical runner; activity-type registry; built-ins (chem balancing, break-even, derivative check) | same gate + activity tests |
| 10 | Knowledge map | SVG map with mastery states + hover reasons | same gate |
| 11 | Polish / security / deployment | a11y, responsive, RLS audit script, README, final full verification | full gate |

### Verification tooling

- `npm run build` — TypeScript + Vite build (must pass after every phase)
- `npm test` — vitest unit tests for pure engines
- `npm run db:verify` — boots embedded PostgreSQL, applies **all** migrations with Supabase stubs, asserts RLS is enabled on every public table
- `npm run dev` — manual smoke of the app (Supabase-connected when `.env` is set; honest setup screen otherwise)
