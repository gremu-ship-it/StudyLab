-- StudyLab v0.2 — Phase 1: Learning Session foundation
-- Adds the knowledge model (concepts, objectives, prerequisites), the
-- first-class Learning Session system (session instances + ordered steps
-- with progressive unlock), and content fields needed to render a session.
--
-- Design notes:
-- * learning_session_steps reference existing content via FKs (unit / question
--   / practical) or are generated steps (objective, diagnostic, assessment,
--   reflection, mastery) that carry no content ref.
-- * One active session per (student, topic): a student always resumes where
--   they stopped.
-- * Student-authored curriculum rows carry created_by and are only
--   writable by their author (RLS below).

-- ============================================================
-- Knowledge model
-- ============================================================

create table if not exists public.concepts (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  name text not null,
  description text,
  definition text,
  formula text,
  difficulty integer check (difficulty between 1 and 5),
  sequence_number integer,
  status text not null default 'active' check (status in ('draft','active','archived')),
  source_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(topic_id, name)
);

create table if not exists public.concept_prerequisites (
  id uuid primary key default gen_random_uuid(),
  prerequisite_id uuid not null references public.concepts(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  confidence numeric not null default 1 check (confidence between 0 and 1),
  source_type text,
  created_at timestamptz not null default now(),
  unique(prerequisite_id, concept_id),
  check (prerequisite_id <> concept_id)
);

create table if not exists public.learning_objectives (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references public.courses(id) on delete set null,
  topic_id uuid references public.topics(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  statement text not null,
  sequence_number integer,
  status text not null default 'active' check (status in ('draft','active','archived')),
  source_type text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (course_id is not null or topic_id is not null or concept_id is not null)
);

-- ============================================================
-- Learning sessions
-- ============================================================

create table if not exists public.learning_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  study_session_id uuid references public.study_sessions(id) on delete set null,
  title text,
  status text not null default 'active' check (status in ('active','paused','completed','abandoned')),
  current_step integer not null default 0,
  difficulty_floor integer check (difficulty_floor between 1 and 5),
  diagnostic_score numeric check (diagnostic_score between 0 and 100),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists learning_sessions_one_active_per_topic
  on public.learning_sessions (student_id, topic_id)
  where status in ('active', 'paused');

create table if not exists public.learning_session_steps (
  id uuid primary key default gen_random_uuid(),
  learning_session_id uuid not null references public.learning_sessions(id) on delete cascade,
  learning_unit_id uuid references public.learning_units(id) on delete set null,
  question_id uuid references public.questions(id) on delete set null,
  practical_id uuid references public.practicals(id) on delete set null,
  step_number integer not null,
  step_type text not null check (step_type in (
    'objective','diagnostic','explanation','definition','example',
    'worked_example','visual','practice','application','practical',
    'assessment','reflection','mastery'
  )),
  title text not null,
  status text not null default 'locked' check (status in (
    'locked','unlocked','in_progress','completed','skipped'
  )),
  completed_at timestamptz,
  score numeric check (score between 0 and 100),
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  unique(learning_session_id, step_number),
  check ((learning_unit_id is not null)::int
       + (question_id is not null)::int
       + (practical_id is not null)::int <= 1)
);

-- ============================================================
-- Content extensions (existing tables, additive columns)
-- ============================================================

-- learning_units: rich content for session rendering
alter table public.learning_units add column if not exists body text;
alter table public.learning_units add column if not exists formula text;
alter table public.learning_units add column if not exists media jsonb not null default '{}'::jsonb;
alter table public.learning_units add column if not exists created_by uuid;
do $$ begin
  alter table public.learning_units
    add constraint learning_units_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
exception when duplicate_object then null; end $$;

-- questions: knowledge links + scaffolding + diagnostics
alter table public.questions add column if not exists concept_id uuid;
alter table public.questions add column if not exists skill_id uuid;
alter table public.questions add column if not exists learning_objective_id uuid;
alter table public.questions add column if not exists is_diagnostic boolean not null default false;
alter table public.questions add column if not exists scaffolding jsonb not null default '{}'::jsonb;
alter table public.questions add column if not exists created_by uuid;
do $$ begin
  alter table public.questions
    add constraint questions_concept_id_fkey
    foreign key (concept_id) references public.concepts(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.questions
    add constraint questions_skill_id_fkey
    foreign key (skill_id) references public.skills(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.questions
    add constraint questions_learning_objective_id_fkey
    foreign key (learning_objective_id) references public.learning_objectives(id) on delete set null;
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.questions
    add constraint questions_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
exception when duplicate_object then null; end $$;

-- topics: student-authored curriculum provenance
alter table public.topics add column if not exists created_by uuid;
do $$ begin
  alter table public.topics
    add constraint topics_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ============================================================
-- Indexes
-- ============================================================

create index if not exists idx_concepts_topic on public.concepts(topic_id);
create index if not exists idx_concept_prerequisites_on on public.concept_prerequisites(concept_id);
create index if not exists idx_objectives_topic on public.learning_objectives(topic_id);
create index if not exists idx_objectives_concept on public.learning_objectives(concept_id);
create index if not exists idx_sessions_student on public.learning_sessions(student_id, status);
create index if not exists idx_session_steps_session on public.learning_session_steps(learning_session_id, step_number);
create index if not exists idx_questions_concept on public.questions(concept_id);

-- updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array['concepts','learning_objectives','learning_sessions'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- Seed generic cross-course skills (shared vocabulary for the
-- mastery engine; course-specific skills are added by the curriculum)
-- ============================================================

insert into public.skills (name, description, skill_type) values
  ('algebraic manipulation', 'Rearranging and simplifying symbolic expressions', 'mathematical'),
  ('numerical calculation', 'Accurate computation with units and significant figures', 'mathematical'),
  ('graph interpretation', 'Reading and interpreting graphs, slopes and areas', 'mathematical'),
  ('equation balancing', 'Balancing and manipulating chemical equations', 'scientific'),
  ('data analysis', 'Extracting patterns and drawing conclusions from data', 'scientific'),
  ('reasoning', 'Structured logical reasoning and argument construction', 'general')
on conflict (name) do nothing;

-- ============================================================
-- RLS
-- ============================================================

alter table public.concepts enable row level security;
alter table public.concept_prerequisites enable row level security;
alter table public.learning_objectives enable row level security;
alter table public.learning_sessions enable row level security;
alter table public.learning_session_steps enable row level security;

create policy "authenticated read concepts" on public.concepts for select to authenticated
  using (status <> 'archived');
create policy "students insert own concepts" on public.concepts for insert to authenticated
  with check (created_by = auth.uid());
create policy "students update own concepts" on public.concepts for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own concepts" on public.concepts for delete to authenticated
  using (created_by = auth.uid());

create policy "authenticated read concept prerequisites" on public.concept_prerequisites for select to authenticated
  using (true);
create policy "authenticated link concept prerequisites" on public.concept_prerequisites for insert to authenticated
  with check (true);
create policy "authenticated unlink concept prerequisites" on public.concept_prerequisites for delete to authenticated
  using (true);

create policy "authenticated read objectives" on public.learning_objectives for select to authenticated
  using (status <> 'archived');
create policy "students insert own objectives" on public.learning_objectives for insert to authenticated
  with check (created_by = auth.uid());
create policy "students update own objectives" on public.learning_objectives for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own objectives" on public.learning_objectives for delete to authenticated
  using (created_by = auth.uid());

create policy "students manage own learning sessions" on public.learning_sessions for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own session steps" on public.learning_session_steps for all to authenticated
  using (exists (select 1 from public.learning_sessions s where s.id = learning_session_id and s.student_id = auth.uid()))
  with check (exists (select 1 from public.learning_sessions s where s.id = learning_session_id and s.student_id = auth.uid()));

-- Student-authored curriculum rows (topics, units, questions)
create policy "students insert own topics" on public.topics for insert to authenticated
  with check (created_by = auth.uid());
create policy "students update own topics" on public.topics for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own topics" on public.topics for delete to authenticated
  using (created_by = auth.uid());

create policy "students insert own units" on public.learning_units for insert to authenticated
  with check (created_by = auth.uid());
create policy "students update own units" on public.learning_units for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "students delete own units" on public.learning_units for delete to authenticated
  using (created_by = auth.uid());

create policy "students insert own questions" on public.questions for insert to authenticated
  with check (created_by = auth.uid());
create policy "students update own draft questions" on public.questions for update to authenticated
  using (created_by = auth.uid() and status in ('draft','review'))
  with check (created_by = auth.uid() and status in ('draft','review'));
create policy "students delete own draft questions" on public.questions for delete to authenticated
  using (created_by = auth.uid() and status in ('draft','review'));
