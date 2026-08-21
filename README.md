# StudyLab MVP v0.1

StudyLab is an adaptive learning companion initially seeded for the LUANAR BSc in Natural & Applied Science.

## Product principle

Curriculum -> Topic -> Learning -> Practice -> Assessment -> Mastery -> Recommendation.

The current timetable is treated as a **curriculum seed**, not a complete degree syllabus. Topics can be added later through the Curriculum Inbox.

## Stack

- React + TypeScript + Vite
- Supabase Auth / PostgreSQL / Storage
- Future: Edge Functions for AI orchestration and content processing

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Add the Supabase URL and anon key to `.env` when connecting the app to a project.

## Database

Run:

`supabase/migrations/0001_studylab_v0_1.sql`

in a fresh Supabase project SQL editor.

The migration includes the curriculum model, student progress model, RLS policies, private storage bucket, and initial LUANAR seed data.

## Important v0.1 boundary

The migration intentionally does not invent topic-level LUANAR curriculum. Topics are expected to enter through lecturer material, student input, or an administrator/verified curriculum source.

## Next build stages

1. Connect dashboard/course pages to Supabase.
2. Add authentication and student onboarding.
3. Implement Curriculum Inbox persistence.
4. Add topic pages and learning units.
5. Add curated YouTube resources.
6. Add question/practice engine.
7. Add AI tutor through a server-side Edge Function.
8. Add mastery/review calculations.
9. Add practical simulations.
