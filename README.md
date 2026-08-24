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

- **Frontend** — React 19 + TypeScript + Vite (hash router, no demo data), served as a static build on Vercel (`vercel.json`)
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

No `.env`? The Setup screen also takes a **Project URL + anon key** and saves
them to that browser (localStorage), so you can connect a hosted deployment or
try someone else's project without rebuilding. Build-time `VITE_*` values
always win over a browser-saved pair, and a secret key is rejected by the form.

## Deploy to Vercel

The frontend is a static SPA, so Vercel only has to serve the built `dist/` —
there are no Vercel serverless functions in this project. Supabase stays where
it is: Auth, Postgres, Storage and the two Edge Functions keep running on
Supabase, and the deployed app talks to them directly from the browser using
the public anon key (RLS is the security boundary).

[`vercel.json`](vercel.json) pins the deployment so the dashboard does not have
to be configured by hand:

| Key | Value | Why |
| --- | ----- | --- |
| `framework` | `vite` | Vite preset |
| `installCommand` | `npm ci --no-audit --no-fund` | Reproducible from `package-lock.json` |
| `buildCommand` | `npm run build` | `tsc -b && vite build` — the type-check is part of the gate |
| `outputDirectory` | `dist` | Vite's production output |
| `rewrites` | `/(.*) → /index.html` | SPA fallback for any deep path |
| `headers` | immutable `/assets/*`, no-cache `/`, `nosniff` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy` | Hashed assets cache for a year; HTML always revalidates |

### Steps

1. **Import the repo** at <https://vercel.com/new> and pick the StudyLab
   repository. Framework preset, install/build commands and output directory
   are read from `vercel.json` — leave those fields untouched.
2. **Set the environment variables** (Project → Settings → Environment
   Variables) for **Production** and **Preview**:

   | Name | Value |
   | ---- | ----- |
   | `VITE_SUPABASE_URL` | `https://<your-project>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | the `anon` **public** key |

   `VITE_*` values are inlined into the bundle at **build time**, so changing
   one needs a redeploy (Deployments → ⋯ → Redeploy). The anon key is public by
   design; the `service_role` key must never be added here (or anywhere in the
   frontend).

   Rather not bake them in? Leave them unset and connect from the deployed
   **Setup** screen instead — it stores a Project URL + anon key in that
   browser only. Useful for previews and demos; env vars stay the right answer
   for a production domain.
3. **Point Supabase Auth at the deployed URL** — Authentication → URL
   Configuration: set *Site URL* to the production origin
   (`https://<your-app>.vercel.app`). Sign-up confirmation emails link back to
   *Site URL* and the hash router picks the session up from there. Also add the
   preview pattern `https://*-<your-vercel-team>.vercel.app/**` to *Redirect
   URLs* — Supabase supports `*`/`**` wildcards — so preview deployments work
   now and any future OAuth / magic-link / password-reset flow redirects to the
   right origin. (If you have restricted CORS in the project's API settings, add
   the Vercel domains there too.)
4. **Deploy.** The database migrations must already be applied to that Supabase
   project (`supabase/migrations/*.sql` in order, or `supabase db push`) — see
   [Database](#database). If the two variables are missing the deployed site
   does not fail silently: it boots into the honest **Setup** screen.

CLI alternative, once the project is linked:

```bash
npm i -g vercel
vercel link
vercel env add VITE_SUPABASE_URL      # paste the project URL
vercel env add VITE_SUPABASE_ANON_KEY # paste the anon public key
vercel build --prod                   # local dry-run of the production build
vercel --prod                         # ship it
```

Local dry-run without the CLI: `npm run build && npm run preview` and open the
printed URL — that is the same `dist/` Vercel serves (minus the `vercel.json`
headers/rewrite, which only Vercel's edge applies).

**Content-Security-Policy is deliberately not set.** The Supabase origin comes
from an environment variable (so a project on a custom or self-hosted domain
would be blocked by a hard-coded `connect-src`), and the UI sets inline
`style` attributes. If you want one, add `connect-src 'self'
https://<your-project>.supabase.co wss://<your-project>.supabase.co` and
`style-src 'self' 'unsafe-inline'` to the `headers` array.

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
`recommendations`, `sources`, `progress`, `practical-activities`,
`supabase-config`) and are covered by Vitest; `test/supabase-connection.test.ts`
covers which connection source wins at runtime.

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
