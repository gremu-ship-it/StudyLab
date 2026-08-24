# StudyLab

An AI-powered, source-grounded learning environment. Seeded for the LUANAR
BSc in Natural & Applied Science, but the curriculum is **flexible by design** —
courses, topics, objectives, units, questions and resources can be added by
students and lecturers, imported, or generated from uploaded material.

```
Curriculum → Topic → Learning Session → Practice → Assessment → Mastery → Recommendation
```

The 2-week timetable from the original MVP is treated only as a **curriculum
seed**, never as a hard-coded product limit.

## Stack

- **Frontend** — React 19 + TypeScript + Vite (hash router, no demo data)
- **Backend** — Supabase: PostgreSQL (RLS on every table), Auth, Storage, Edge Functions
- **AI** — Anthropic or OpenAI, called **only from Edge Functions**; keys never reach the browser
- **Local tooling** — embedded PostgreSQL migration harness + Vitest unit tests

## Product principles (enforced, not suggested)

1. **Learning Sessions** are first-class: objectives → diagnostic →
   explanation/definition/example/worked example → guided & independent
   practice → application → practical → assessment → Feynman explain-back →
   mastery evaluation → scheduled review. Steps unlock progressively; one
   active session per student per topic.
2. **Active-learning scaffolding, never answer-first**: attempt → identify
   the reasoning gap → hint → guiding question → partial help → reveal →
   "why it works" → try again.
3. **4-level source hierarchy** on every item: L1 student/lecturer/university
   material · L2 authoritative academic · L3 curated external · L4 AI-generated.
   AI text is never presented as authoritative; no sources ⇒ an explicit
   "insufficient sources" state.
4. **Uploaded documents are never modified.** Originals are stored untouched in
   a private bucket; extraction produces derived `extracted_content` rows with
   page + confidence provenance, and is labelled L1 "from your upload".
5. **Mastery discrimination**: the engine separates easy items from
   application items. A student who passes easy items but fails application
   items is capped at *developing*, never *mastered*. States:
   not_assessed / weak / developing / strong / mastered.
6. **Honest pending states**: features that need an external service
   (AI provider, PDF parsing) say so in the UI instead of faking output.

## Run locally

```bash
npm install
cp .env.example .env        # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev                 # without .env the app shows an honest setup screen
```

## Scripts

| Script            | What it does                                                        |
| ----------------- | ------------------------------------------------------------------- |
| `npm run dev`     | Vite dev server                                                       |
| `npm run build`   | Type-check + production build                                         |
| `npm run typecheck` | `tsc -b` across the project                                           |
| `npm test`        | Vitest: grading, mastery, session planning, recommendations, document extraction, practical activities |
| `npm run db:verify` | Boots an embedded PostgreSQL, applies **all** `supabase/migrations/*.sql` in order against Supabase stubs, asserts **RLS is enabled on every public table**, prints table/policy/seed counts. Exits 1 on any failure. `node scripts/local-db.mjs --query "<sql>"` queries the persistent local DB. |

## Database

Seven migrations (apply in order; all are idempotent):

| File | Adds |
| ---- | ---- |
| `0001_studylab_v0_1.sql` | Curriculum model (institution → programme → courses → topics → subtopics), student model, content (units, questions, practicals, resources), progress (attempts, mastery, review schedule, recommendations), uploads, AI conversation log, RLS, private `student-materials` bucket, LUANAR seed |
| `0002_learning_sessions.sql` | Knowledge model (concepts, prerequisites, objectives), **Learning Sessions** + ordered steps with progressive unlock, one-active-per-topic invariant, 6 seeded skills |
| `0003_sources_provenance.sql` | `source_level` (1–4) + `provenance` on resources, ingestion bookkeeping, `extracted_content` (service-role writes, owner-read RLS) |
| `0004_assessments_mastery.sql` | Session-linked attempts with `attempt_number`, `assessments` + `assessment_attempts`, `concept_mastery` (unique per student+concept), widened mastery-level vocabulary |
| `0005_ai_reflection.sql` | `explain_back_attempts` (Feynman mode) — stored immediately, AI evaluation fills `score`/`ai_feedback` later or stays null ("evaluation pending") |
| `0006_practical_activities.sql` | `activity_attempts` — real records of guided quick-activity completions |
| `0007_own_draft_visibility.sql` | Authors can read their own draft/review questions & assessments (published rows stay the public surface) |

**Security model**

- RLS is enabled on **every** public table; `db:verify` fails the build gate
  if a new table ships without it.
- Student rows are scoped with `student_id = auth.uid()`; student-authored
  curriculum rows are writable only by their author while `draft`/`review`.
- Uploaded files live in a **private** `student-materials` bucket; the
  `process-material` Edge Function reads them server-side (service role) and
  never writes back to the original.
- AI keys exist only as Edge Function secrets (`ANTHROPIC_API_KEY` /
  `OPENAI_API_KEY`). Edge Functions verify the student's Supabase JWT before
  doing any work and re-check resource ownership.

## Edge Functions

```bash
supabase db push
supabase functions deploy ai-tutor
supabase functions deploy process-material
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # or OPENAI_API_KEY
```

- **`ai-tutor`** — receives the full learning context (programme, course,
  topic, mastery, weak concepts, recent attempts, the student's *sources*
  with levels) and returns `{content, source_level, needs_more_info,
  missing_info?}`. The source policy is enforced server-side: no sources ⇒
  level 4 + `needs_more_info`. `feynman_evaluate` returns a `<n> / 100` score
  plus strengths/gaps/next step. No provider configured ⇒ `503
  ai_not_configured` and the UI shows a pending banner.
- **`process-material`** — reads a student's upload (read-only), extracts
  headings / definitions / formulas / questions / objectives / activities
  with a **deterministic, unit-tested parser** (no AI), writes
  `extracted_content` rows, marks the material `ready` — or honestly reports
  PDF/Office as *pending in this build*.

Both functions live in `supabase/functions/` and import local TypeScript
files; the extraction parser is shared with `test/extract.test.ts` so tests
and runtime cannot drift.

## Frontend map

| Route | Page |
| ----- | ---- |
| `#/` | Dashboard — today's plan, continue, recommendations (each with a *why*), weak areas, review due, course progress |
| `#/courses`, `#/courses/:id` | Courses + workspace (Overview / Topics / Resources / Practice / Assessments / Practicals) |
| `#/topics/:id` | Topic detail — start/resume a Learning Session; author objectives, concepts, units, questions, prerequisites |
| `#/session/:id` | Session runner — numbered step list with lock state, diagnostics with fast-track, scaffolded questions, practicals, reflection, mastery |
| `#/materials` | Uploads + extraction (originals preserved, items provenanced) |
| `#/map` | Knowledge map — topics & concepts coloured by mastery, explains the recommendations |
| `#/tutor` | Contextual AI tutor — 11 tasks (explain, analogy, quiz, why-wrong, …) + Feynman mode; quiz/hint work deterministically from the question bank even with no AI configured |

## Testing & verification gate

Every phase ships with: `npm run typecheck` · `npm test` · `npm run build` ·
`npm run db:verify` (migrations + RLS) · manual smoke of the changed surface.
Pure engines live in `src/lib/` (`answer`, `mastery`, `session`,
`recommendations`, `sources`, `progress`, `practical-activities`) and are
covered by Vitest.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full 8-part
assessment: current architecture, reusable components, gaps, DB/API/UI/AI
changes, and the implementation-phase plan.

## Pending (honest list)

- PDF/PowerPoint/Word extraction (parser contract is in place; binary
  formats report *pending* in the UI).
- AI evaluation of Feynman explain-backs (attempts are saved and marked
  *evaluation pending* until a provider key is configured).
- Lecturer/admin roles and curriculum approval workflow (students currently
  author as `draft`/`student_added`; status gating is in the schema).
