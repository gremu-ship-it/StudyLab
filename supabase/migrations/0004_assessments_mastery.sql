-- StudyLab v0.2 — Phase 5+6: Assessment engine & concept-level mastery
-- * question_attempts now link to a learning_session and carry an
--   attempt_number (re-attempts of the same item inside a session).
-- * assessments: a titled set of questions (question_ids) with a pass mark
--   and optional time limit — authored per course/topic, gated by status.
-- * assessment_attempts: one row per student sitting, with per-question
--   results stored as jsonb so per-item review is possible.
-- * concept_mastery: mastery tracked at concept granularity (the engine
--   distinguishes easy vs application items; a student who passes easy
--   items but fails application items is capped at 'developing').
--
-- RLS: students own their attempts and mastery rows; assessments follow the
-- same status-gated read pattern as questions (review/approved visible to
-- students, writable only by their author while draft/review).

-- ============================================================
-- Question attempt enrichment
-- ============================================================

alter table public.question_attempts
  add column if not exists learning_session_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'question_attempts_learning_session_id_fkey'
  ) then
    alter table public.question_attempts
      add constraint question_attempts_learning_session_id_fkey
      foreign key (learning_session_id) references public.learning_sessions(id)
      on delete set null;
  end if;
end $$;

alter table public.question_attempts
  add column if not exists attempt_number integer not null default 1;

create index if not exists idx_question_attempts_session
  on public.question_attempts(learning_session_id);

-- ============================================================
-- Assessments
-- ============================================================

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  description text,
  question_ids jsonb not null default '[]'::jsonb,
  pass_percent numeric not null default 70 check (pass_percent between 0 and 100),
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds > 0),
  status text not null default 'draft' check (status in ('draft','review','approved','archived')),
  source_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (course_id is not null or topic_id is not null)
);

create index if not exists idx_assessments_course on public.assessments(course_id);
create index if not exists idx_assessments_topic on public.assessments(topic_id);
create index if not exists idx_assessments_status on public.assessments(status);

-- ============================================================
-- Assessment attempts
-- ============================================================

create table if not exists public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  learning_session_id uuid references public.learning_sessions(id) on delete set null,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  score numeric check (score between 0 and 100),
  passed boolean,
  question_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_assessment_attempts_student
  on public.assessment_attempts(student_id, created_at desc);
create index if not exists idx_assessment_attempts_assessment
  on public.assessment_attempts(assessment_id);

-- ============================================================
-- Concept mastery
-- ============================================================

create table if not exists public.concept_mastery (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  mastery_score numeric not null default 0 check (mastery_score between 0 and 100),
  mastery_level text not null default 'not_assessed'
    check (mastery_level in ('not_assessed','weak','developing','strong','mastered')),
  confidence_score numeric not null default 0 check (confidence_score between 0 and 100),
  attempt_count integer not null default 0,
  last_assessed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(student_id, concept_id)
);

create index if not exists idx_concept_mastery_student on public.concept_mastery(student_id);
create index if not exists idx_concept_mastery_concept on public.concept_mastery(concept_id);

-- ============================================================
-- topic_mastery level vocabulary
-- The mastery engine writes not_assessed/weak/developing/strong/mastered;
-- widen the 0001 check constraint (which used a legacy vocabulary) so
-- upserts from the engine never violate it. Legacy values stay allowed.
-- ============================================================

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'topic_mastery_mastery_level_check'
      and conrelid = 'public.topic_mastery'::regclass
  ) then
    alter table public.topic_mastery
      drop constraint topic_mastery_mastery_level_check;
  end if;
end $$;

alter table public.topic_mastery
  add constraint topic_mastery_mastery_level_check
  check (mastery_level in (
    'not_assessed','not_started','learning','weak',
    'developing','functional','strong','mastered'
  ));

-- ============================================================
-- updated_at triggers
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array['assessments','concept_mastery']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.assessments enable row level security;
alter table public.assessment_attempts enable row level security;
alter table public.concept_mastery enable row level security;

-- Students see published assessments; authors manage their own drafts.
create policy "authenticated read published assessments"
  on public.assessments for select to authenticated
  using (status in ('review','approved'));

create policy "students insert own assessments"
  on public.assessments for insert to authenticated
  with check (created_by = auth.uid() and status in ('draft','review'));

create policy "students update own assessments"
  on public.assessments for update to authenticated
  using (created_by = auth.uid() and status in ('draft','review'))
  with check (created_by = auth.uid() and status in ('draft','review'));

create policy "students delete own assessments"
  on public.assessments for delete to authenticated
  using (created_by = auth.uid() and status in ('draft','review'));

create policy "students manage own assessment attempts"
  on public.assessment_attempts for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

create policy "students manage own concept mastery"
  on public.concept_mastery for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

-- ============================================================
-- Grants
-- ============================================================

grant select on public.assessments to authenticated;
grant insert, update, delete on public.assessments to authenticated;
grant select, insert, update, delete on public.assessments to service_role;

grant select, insert, update, delete on public.assessment_attempts to authenticated;
grant select, insert, update, delete on public.assessment_attempts to service_role;

grant select, insert, update, delete on public.concept_mastery to authenticated;
grant select, insert, update, delete on public.concept_mastery to service_role;
