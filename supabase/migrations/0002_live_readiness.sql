-- StudyLab 0002 — live readiness for the expanded app.
-- Apply AFTER 0001_studylab_v0_1.sql.

-- ---------------------------------------------------------------
-- 1.  Add columns introduced by the current app that were not in
--     the v0.1 migration.
-- ---------------------------------------------------------------
alter table public.study_sessions
  add column if not exists topic_id uuid references public.topics(id) on delete set null,
  add column if not exists note text;

alter table public.learning_units
  add column if not exists body text;

alter table public.content_resources
  add column if not exists source_type text;

-- Student-added curriculum ownership (lets students author their own
-- topics/units/questions while shared curriculum remains read-only).
alter table public.topics                add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.subtopics             add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.learning_units        add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.questions             add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.question_options      add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.practicals            add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.practical_steps       add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.skills                add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table public.content_resources     add column if not exists created_by uuid references auth.users(id) on delete set null;

-- ---------------------------------------------------------------
-- 2.  RLS: students may create/update/delete their OWN authored
--     curriculum content.  Approved/shared content stays readable.
-- ---------------------------------------------------------------
create policy "students insert own topics"    on public.topics    for insert to authenticated with check (created_by = auth.uid());
create policy "students update own topics"    on public.topics    for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own topics"    on public.topics    for delete to authenticated using (created_by = auth.uid());

create policy "students insert own subtopics" on public.subtopics for insert to authenticated with check (created_by = auth.uid());
create policy "students manage own subtopics" on public.subtopics for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own subtopics" on public.subtopics for delete to authenticated using (created_by = auth.uid());

create policy "students insert own units"     on public.learning_units for insert to authenticated with check (created_by = auth.uid());
create policy "students manage own units"     on public.learning_units for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own units"     on public.learning_units for delete to authenticated using (created_by = auth.uid());
-- Students can read all approved units plus their own drafts.
drop policy if exists "authenticated read learning units" on public.learning_units;
create policy "authenticated read learning units" on public.learning_units
  for select to authenticated using (status = 'approved' or created_by = auth.uid());

create policy "students insert own questions" on public.questions for insert to authenticated with check (created_by = auth.uid());
create policy "students manage own questions" on public.questions for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own questions" on public.questions for delete to authenticated using (created_by = auth.uid());
-- Students can read approved questions plus their own (drafts/review).
drop policy if exists "authenticated read approved questions" on public.questions;
create policy "authenticated read approved questions" on public.questions
  for select to authenticated using (status = 'approved' or created_by = auth.uid());

create policy "students insert own options"   on public.question_options for insert to authenticated with check (created_by = auth.uid());
create policy "students manage own options"   on public.question_options for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own options"   on public.question_options for delete to authenticated using (created_by = auth.uid());
drop policy if exists "authenticated read question options" on public.question_options;
create policy "authenticated read question options" on public.question_options
  for select to authenticated using (
    exists (select 1 from public.questions q where q.id = question_id and (q.status = 'approved' or q.created_by = auth.uid()))
  );

create policy "students insert own practicals" on public.practicals for insert to authenticated with check (created_by = auth.uid());
create policy "students manage own practicals" on public.practicals for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own practicals" on public.practicals for delete to authenticated using (created_by = auth.uid());
drop policy if exists "authenticated read practicals" on public.practicals;
create policy "authenticated read practicals" on public.practicals
  for select to authenticated using (status = 'approved' or created_by = auth.uid());

create policy "students insert own practical steps" on public.practical_steps for insert to authenticated with check (created_by = auth.uid());
create policy "students manage own practical steps" on public.practical_steps for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own practical steps" on public.practical_steps for delete to authenticated using (created_by = auth.uid());
drop policy if exists "authenticated read practical steps" on public.practical_steps;
create policy "authenticated read practical steps" on public.practical_steps
  for select to authenticated using (
    exists (select 1 from public.practicals p where p.id = practical_id and (p.status = 'approved' or p.created_by = auth.uid()))
  );

-- Skills + content resources: students author their own, shared ones are readable.
create policy "students insert own skills"    on public.skills for insert to authenticated with check (created_by = auth.uid());
create policy "students manage own skills"    on public.skills for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students insert own resources" on public.content_resources for insert to authenticated with check (created_by = auth.uid());
create policy "students manage own resources" on public.content_resources for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own resources" on public.content_resources for delete to authenticated using (created_by = auth.uid());
create policy "students link own resources"   on public.topic_resources for insert to authenticated with check (true);

-- ---------------------------------------------------------------
-- 3.  Optional: storage for uploaded materials is already
--     created in 0001.  Add a max-size guard (10 MB) for safety.
-- ---------------------------------------------------------------
-- (No DDL needed; client enforces limits in the demo.)

-- ---------------------------------------------------------------
-- 4.  Note on seed content
-- ---------------------------------------------------------------
-- The app ships a rich browser seed (topics, units, questions,
-- practicals, video lessons). In a fresh Supabase project, run the
-- app once and use the "Load sample curriculum" action in the
-- Data Explorer, OR insert curriculum directly with created_by = null
-- for institution-wide content. The core institutions/programmes/
-- courses from 0001 are already present.
