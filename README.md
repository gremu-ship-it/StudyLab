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

The app runs in **two modes**:

- **Demo mode (default):** no backend needed. A rich multi-institution seed (LUANAR, MUST, UNIMA) with courses, topics, learning units, questions, practicals, video lessons, recommendations and a study plan is loaded into the browser. All progress is persisted in `localStorage` through a typed data-access layer (`src/store.ts`).
- **Live mode:** when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, users sign in (email/password or magic link) and all student-owned data — enrolments, mastery, review schedule, recommendations, study plans, uploads, AI conversations — syncs to Supabase. The same store methods write through to the backend; the UI is unchanged.

A green **"Live · synced"** badge in the top bar confirms cloud sync; a grey **"Demo mode"** badge means local data.

```bash
npm run build     # type-check + production build to dist/
```

## Features

| Area | What you can do |
|---|---|
| **Dashboard** | Mastery ring, weekly study time, reviews due, daily plan, prioritised recommendations, strongest/weakest topics |
| **Courses** | All 14 LUANAR courses grouped by category with live mastery and lecturer |
| **Course workspace** | Topic browser; learning units (explanations, worked examples, video, reflection, review) with completion; in-topic quiz; practicals; **Video Lessons** tab with inline YouTube embeds + "Add link"; structure editor (add subtopics and units) |
| **Video Lessons** | Every topic can embed YouTube lessons (watch URLs, shorts, playlists all supported) with thumbnails and an inline player; students/lecturers can paste any YouTube, article or document link. Lessons come from 3Blue1Brown, Khan Academy, CrashCourse, Amoeba Sisters, MIT OCW, CS50 and others |
| **Multi-institution** | The app is institution-agnostic: pick your university and programme in setup, or switch any time from the sidebar/profile. Courses, topics, mastery, recommendations and plan are all scoped per programme. Three institutions are seeded (LUANAR, MUST, UNIMA) and you can add new institutions and programmes in-app |
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

## Going live with Supabase

The app already includes a Supabase client, auth (email/password + magic link), and a live data sync layer. To enable **Live mode**:

1. Create a Supabase project.
2. In the SQL editor, run both migrations in order:
   - `supabase/migrations/0001_studylab_v0_1.sql` — schema, RLS, core seed (institutions, programmes, courses).
   - `supabase/migrations/0002_live_readiness.sql` — columns the expanded app needs (`study_sessions.topic_id/note`, `learning_units.body`, `content_resources.source_type`, `created_by` ownership), and RLS policies letting students manage **their own** topics, units, questions, practicals and resources.
3. Copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
   ```
4. Restart the dev server. You'll see a sign-in screen; create an account (or use a magic link), and the badge in the top bar will switch to **Live · synced**.

### How the sync works

- `src/lib/supabase.ts` creates the client and lists every table.
- `src/lib/live.ts` hydrates all rows the signed-in student can see into the store on sign-in, and upserts/deletes rows as the student makes changes.
- `src/store.ts` is the single state source in both modes; in live mode it generates real UUIDs for new rows and tags student-authored curriculum with `created_by = auth.uid()`, which the RLS policies require.
- Curriculum tables are shared/read-only for institution-authored content; students can add and manage their own topics, subtopics, units, questions, practicals, skills and resources. Student-owned tables (mastery, review, sessions, uploads, AI chats) are fully private per the policies in 0001.

To populate topics/units/questions for everyone, insert them server-side with `created_by = null` (institution content); students see them automatically. To let students author content in the app, the 0002 policies already allow it.
