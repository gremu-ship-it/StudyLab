# StudyLab

Adaptive learning companion, seeded for the LUANAR BSc in Natural & Applied Science.

**Curriculum → Topic → Learning → Practice → Assessment → Mastery → Recommendation.**

![Stack](https://img.shields.io/badge/React-19-6c7cff) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6) ![Vite](https://img.shields.io/badge/Vite-6-646cff)

## Run locally

```bash
npm install
cp .env.example .env      # add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY when connecting a backend
npm run dev
```

The app runs fully in the browser with a realistic LUANAR seed (institutions, programmes, 14 courses, 18 topics, learning units, questions, practicals, resources, recommendations and a study plan). All progress — topics added, units completed, question attempts, mastery, uploads and AI conversations — is persisted in `localStorage` through a typed data-access layer (`src/store.ts`). The same store methods map directly to the Supabase schema, so swapping the in-browser adapter for Supabase queries is a drop-in change.

```bash
npm run build     # type-check + production build to dist/
```

## Features

| Area | What you can do |
|---|---|
| **Dashboard** | Mastery ring, weekly study time, reviews due, daily plan, prioritised recommendations, strongest/weakest topics |
| **Courses** | All 14 LUANAR courses grouped by category with live mastery and lecturer |
| **Course workspace** | Topic browser; learning units (explanations, worked examples, video, reflection, review) with completion; in-topic quiz; practicals; curated resources; structure editor (add subtopics and units) |
| **Study Plan** | Adaptive daily timeline, add blocks, start a tracked session, recent-session history |
| **Curriculum Inbox** | Add student topics; confirm them into the active curriculum |
| **Practice** | Per-topic question banks or a mixed 8-question set; MCQ, true/false, numeric and short-answer; results screen feeds mastery and scheduling |
| **Practicals** | Guided lab activities with objectives, safety, materials, step-by-step procedure and checklists |
| **Review** | SM-2-inspired spaced-repetition schedule: due now, upcoming and full history |
| **Mastery** | Topic and skill mastery analytics with six mastery levels |
| **Materials** | Drag-and-drop uploads with simulated text extraction and AI classification; "Ask AI" on any upload |
| **AI Tutor** | Multi-mode chat (Tutor, Explain, Practice, Revision, Exam prep, Material analysis), multiple conversations, context-aware responses grounded in your topics and units |
| **Profile** | Edit profile, daily target, view activity counts, reset demo data |
| **Data Explorer** | Browse every one of the 28 schema tables (the full domain model), grouped by domain, with filtering |

## Data model

Every entity you asked for is represented — both in the SQL migration (`supabase/migrations/0001_studylab_v0_1.sql`) and as TypeScript domain types (`src/types.ts`):

- **Curriculum:** `institutions`, `programmes`, `academic_periods`, `courses`, `course_offerings`, `topics`, `subtopics`, `skills`, `topic_skills`
- **Content:** `learning_units`, `content_resources`, `topic_resources`, `questions`, `question_options`, `practicals`, `practical_steps`
- **Student:** `student_profiles`, `enrolments`, `student_course_enrolments`
- **Progress:** `study_sessions`, `learning_attempts`, `question_attempts`, `topic_mastery`, `skill_mastery`
- **Adaptive:** `review_schedule`, `recommendations`, `study_plans`, `study_plan_items`
- **Materials & AI:** `uploaded_materials`, `ai_conversations`, `ai_messages`

The full Postgres schema, row-level security, student policies and the private `student-materials` storage bucket are defined in the migration.

## Project structure

```
src/
  types.ts          # domain types mirroring the SQL schema
  seed.ts           # LUANAR seed data (courses, topics, units, questions, practicals...)
  store.ts          # reactive store + persistence, mastery/SM-2 logic, AI responder
  components/ui.tsx # modal, toasts, formatters
  pages/            # Dashboard, Courses, CoursePage, StudyPlan, Inbox, Practice,
                    # Practicals, Review, Mastery, Materials, AITutor, Profile, DataExplorer
  App.tsx           # shell + client-side routing
  styles.css        # design system
```

## Connecting Supabase (next step)

`src/lib/supabase.ts` already exports a Supabase client when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set. To go live with a real backend:

1. Create a Supabase project and run `supabase/migrations/0001_studylab_v0_1.sql` in the SQL editor.
2. Add your URL and anon key to `.env`.
3. Replace the in-memory/localStorage methods in `src/store.ts` with the equivalent `supabase.from(...).select/insert/update` calls — the method signatures already match the table shapes.
4. Add Supabase Auth for `student_profiles.id`; the RLS policies already key off `auth.uid()`.
