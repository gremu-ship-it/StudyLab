-- StudyLab v0.1
-- Supabase/PostgreSQL base architecture.
-- Curriculum is intentionally open-ended: courses are seeded from the current timetable,
-- while topics may be added later as lecturers introduce them.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  short_name text,
  country text,
  website_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  name text not null,
  code text,
  description text,
  duration_years integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(institution_id, name)
);

create table if not exists public.academic_periods (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete restrict,
  academic_year integer not null,
  year_level integer not null check (year_level > 0),
  semester integer not null check (semester in (1,2)),
  name text not null,
  start_date date,
  end_date date,
  status text not null default 'active' check (status in ('draft','active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(programme_id, academic_year, year_level, semester)
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete restrict,
  code text not null,
  name text not null,
  category text,
  description text,
  credits numeric,
  course_type text,
  status text not null default 'confirmed' check (status in ('confirmed','provisional','student_added','archived')),
  source_type text,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(programme_id, code)
);

create table if not exists public.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  lecturer_name text,
  status text not null default 'active' check (status in ('planned','active','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, academic_period_id)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete restrict,
  name text not null,
  description text,
  sequence_number integer,
  status text not null default 'student_added' check (status in ('draft','confirmed','student_added','archived')),
  source_type text,
  source_reference text,
  estimated_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(course_id, name)
);

create table if not exists public.subtopics (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  name text not null,
  description text,
  sequence_number integer,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(topic_id, name)
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  skill_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topic_skills (
  topic_id uuid not null references public.topics(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  importance numeric not null default 1 check (importance >= 0),
  primary key(topic_id, skill_id)
);

create table if not exists public.learning_units (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  title text not null,
  unit_type text not null check (unit_type in ('explanation','video','worked_example','interactive','practical','practice','reflection','review')),
  sequence_number integer,
  description text,
  estimated_minutes integer,
  difficulty integer check (difficulty between 1 and 5),
  status text not null default 'draft' check (status in ('draft','review','approved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  resource_type text not null check (resource_type in ('youtube','document','website','textbook','simulation','image','other')),
  url text,
  provider text,
  author text,
  duration_seconds integer,
  difficulty integer check (difficulty between 1 and 5),
  status text not null default 'active' check (status in ('draft','active','unavailable','archived')),
  source_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.topic_resources (
  topic_id uuid not null references public.topics(id) on delete cascade,
  resource_id uuid not null references public.content_resources(id) on delete cascade,
  relationship_type text not null default 'supports',
  sequence_number integer,
  primary key(topic_id, resource_id)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  subtopic_id uuid references public.subtopics(id) on delete set null,
  question_type text not null check (question_type in ('multiple_choice','short_answer','numeric','true_false','matching','scenario')),
  difficulty integer not null default 1 check (difficulty between 1 and 5),
  question_text text not null,
  explanation text,
  hint_1 text,
  hint_2 text,
  correct_answer jsonb not null,
  estimated_seconds integer,
  status text not null default 'draft' check (status in ('draft','review','approved','retired')),
  source_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_key text not null,
  option_text text not null,
  sequence_number integer not null,
  unique(question_id, option_key)
);

create table if not exists public.practicals (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  title text not null,
  objective text,
  background text,
  materials jsonb,
  safety_notes text,
  procedure jsonb,
  expected_outcome text,
  assessment_notes text,
  status text not null default 'draft' check (status in ('draft','review','approved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.practical_steps (
  id uuid primary key default gen_random_uuid(),
  practical_id uuid not null references public.practicals(id) on delete cascade,
  step_number integer not null,
  instruction text not null,
  expected_action text,
  observation_prompt text,
  unique(practical_id, step_number)
);

create table if not exists public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  institution_id uuid references public.institutions(id) on delete set null,
  programme_id uuid references public.programmes(id) on delete set null,
  current_year integer,
  current_semester integer,
  timezone text default 'Africa/Blantyre',
  study_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.enrolments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete restrict,
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  status text not null default 'active' check (status in ('active','completed','withdrawn')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.student_course_enrolments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  course_offering_id uuid not null references public.course_offerings(id) on delete restrict,
  status text not null default 'active' check (status in ('active','completed','withdrawn')),
  created_at timestamptz not null default now(),
  unique(student_id, course_offering_id)
);

create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer,
  session_type text not null default 'free_study' check (session_type in ('free_study','recommended','exam_prep','revision','practice')),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  learning_unit_id uuid not null references public.learning_units(id) on delete restrict,
  study_session_id uuid references public.study_sessions(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  completion_percent numeric not null default 0 check (completion_percent between 0 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.question_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  study_session_id uuid references public.study_sessions(id) on delete set null,
  answer jsonb,
  is_correct boolean,
  score numeric,
  time_seconds integer,
  confidence integer check (confidence between 1 and 4),
  hints_used integer not null default 0,
  attempted_at timestamptz not null default now()
);

create table if not exists public.topic_mastery (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  mastery_score numeric not null default 0 check (mastery_score between 0 and 100),
  mastery_level text not null default 'not_started' check (mastery_level in ('not_started','learning','developing','functional','strong','mastered')),
  confidence_score numeric not null default 0 check (confidence_score between 0 and 100),
  attempt_count integer not null default 0,
  last_practiced_at timestamptz,
  last_assessed_at timestamptz,
  next_review_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(student_id, topic_id)
);

create table if not exists public.skill_mastery (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  mastery_score numeric not null default 0 check (mastery_score between 0 and 100),
  confidence_score numeric not null default 0 check (confidence_score between 0 and 100),
  attempt_count integer not null default 0,
  last_assessed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(student_id, skill_id)
);

create table if not exists public.review_schedule (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  scheduled_for timestamptz not null,
  interval_days numeric not null default 1,
  ease_factor numeric not null default 2.5,
  status text not null default 'scheduled' check (status in ('scheduled','completed','skipped','cancelled')),
  last_result numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  recommendation_type text not null,
  priority numeric not null default 0,
  reason text not null,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active','accepted','dismissed','expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  target_minutes integer,
  status text not null default 'active' check (status in ('draft','active','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  study_plan_id uuid not null references public.study_plans(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  scheduled_date date not null,
  planned_minutes integer,
  sequence_number integer,
  status text not null default 'planned' check (status in ('planned','started','completed','skipped')),
  created_at timestamptz not null default now()
);

create table if not exists public.uploaded_materials (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint,
  processing_status text not null default 'pending' check (processing_status in ('pending','processing','ready','failed')),
  extracted_text text,
  ai_classification jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  mode text not null default 'tutor' check (mode in ('tutor','explain','practice','revision','exam_prep','material_analysis')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('system','user','assistant','tool')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.topic_relationships (
  id uuid primary key default gen_random_uuid(),
  from_topic_id uuid not null references public.topics(id) on delete cascade,
  to_topic_id uuid not null references public.topics(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('prerequisite','supports','related','builds_on')),
  confidence numeric not null default 1 check (confidence between 0 and 1),
  source_type text,
  created_at timestamptz not null default now(),
  unique(from_topic_id, to_topic_id, relationship_type),
  check(from_topic_id <> to_topic_id)
);

create table if not exists public.curriculum_sources (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete set null,
  title text not null,
  source_type text not null,
  reference text,
  document_date date,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_courses_programme on public.courses(programme_id);
create index if not exists idx_topics_course on public.topics(course_id);
create index if not exists idx_subtopics_topic on public.subtopics(topic_id);
create index if not exists idx_learning_units_topic on public.learning_units(topic_id);
create index if not exists idx_questions_topic on public.questions(topic_id);
create index if not exists idx_question_attempts_student on public.question_attempts(student_id, attempted_at desc);
create index if not exists idx_learning_attempts_student on public.learning_attempts(student_id, created_at desc);
create index if not exists idx_topic_mastery_student on public.topic_mastery(student_id);
create index if not exists idx_review_student_date on public.review_schedule(student_id, scheduled_for);
create index if not exists idx_recommendations_student on public.recommendations(student_id, status);
create index if not exists idx_uploaded_materials_student on public.uploaded_materials(student_id, created_at desc);
create index if not exists idx_ai_messages_conversation on public.ai_messages(conversation_id, created_at);

-- updated_at triggers
do $$
declare
  t text;
begin
  foreach t in array array[
    'institutions','programmes','academic_periods','courses','course_offerings','topics',
    'subtopics','skills','learning_units','content_resources','questions','practicals',
    'student_profiles','topic_mastery','skill_mastery','review_schedule','study_plans',
    'uploaded_materials','ai_conversations'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- Seed institution, programme, current academic period, and current timetable courses.
-- Uses WHERE NOT EXISTS so the migration is idempotent regardless of which unique
-- constraints already exist (avoids 42P10 on partially-migrated databases).
insert into public.institutions (name, short_name, country)
select 'Lilongwe University of Agriculture and Natural Resources', 'LUANAR', 'Malawi'
where not exists (select 1 from public.institutions where name = 'Lilongwe University of Agriculture and Natural Resources');

insert into public.programmes (institution_id, name, description)
select i.id, 'BSc in Natural & Applied Science',
       'Current programme seed based on the supplied timetable. Additional curriculum information will be added as it becomes available.'
from public.institutions i
where i.short_name = 'LUANAR'
  and not exists (
    select 1 from public.programmes p
    where p.institution_id = i.id and p.name = 'BSc in Natural & Applied Science'
  );

insert into public.academic_periods (programme_id, academic_year, year_level, semester, name)
select p.id, 2026, 2, 1, 'Year 2 Semester 1'
from public.programmes p
join public.institutions i on i.id = p.institution_id
where i.short_name = 'LUANAR'
  and p.name = 'BSc in Natural & Applied Science'
  and not exists (
    select 1 from public.academic_periods ap
    where ap.programme_id = p.id and ap.academic_year = 2026 and ap.year_level = 2 and ap.semester = 1
  );

insert into public.courses (programme_id, code, name, category, status, source_type)
select p.id, x.code, x.name, x.category, 'confirmed', 'official_timetable'
from public.programmes p
cross join (values
  ('NMAT31102','College Algebra','Mathematics'),
  ('NMAT32122','Calculus I','Mathematics'),
  ('NBAT32107','Statistics I','Mathematics'),
  ('NPHY31105','Physics I','Physical Sciences'),
  ('NPHY32104','Mechanics I','Physical Sciences'),
  ('NCHE31104','Introductory Chemistry I','Chemistry'),
  ('NCHE32103','Introductory Chemistry III','Chemistry'),
  ('NBIO31101','General Biology I','Biology'),
  ('NBIO32103','Plant Form and Function','Biology'),
  ('NBMB32101','Microbiology','Biology'),
  ('NDEV23203','Ecology','Biology'),
  ('NBAT32104','Soil Science','Agricultural Sciences'),
  ('NCOM31103','Introduction to Computer Systems','Technology'),
  ('NNAS32101','Introduction to Artificial Intelligence','Technology'),
  ('NAAE32101','Introduction to Agricultural Economics','Agricultural Economics')
) as x(code,name,category)
where p.name = 'BSc in Natural & Applied Science'
  and not exists (
    select 1 from public.courses c where c.programme_id = p.id and c.code = x.code
  );

-- RLS
alter table public.student_profiles enable row level security;
alter table public.enrolments enable row level security;
alter table public.student_course_enrolments enable row level security;
alter table public.study_sessions enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.question_attempts enable row level security;
alter table public.topic_mastery enable row level security;
alter table public.skill_mastery enable row level security;
alter table public.review_schedule enable row level security;
alter table public.recommendations enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_items enable row level security;
alter table public.uploaded_materials enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Student-owned data policies.
create policy "students read own profile" on public.student_profiles for select using (id = auth.uid());
create policy "students update own profile" on public.student_profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "students insert own profile" on public.student_profiles for insert with check (id = auth.uid());

create policy "students manage own enrolments" on public.enrolments for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own course enrolments" on public.student_course_enrolments for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own study sessions" on public.study_sessions for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own learning attempts" on public.learning_attempts for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own question attempts" on public.question_attempts for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own topic mastery" on public.topic_mastery for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own skill mastery" on public.skill_mastery for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own review schedule" on public.review_schedule for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own recommendations" on public.recommendations for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own study plans" on public.study_plans for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own plan items" on public.study_plan_items for all using (
  exists (select 1 from public.study_plans sp where sp.id = study_plan_id and sp.student_id = auth.uid())
) with check (
  exists (select 1 from public.study_plans sp where sp.id = study_plan_id and sp.student_id = auth.uid())
);
create policy "students manage own uploads" on public.uploaded_materials for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own conversations" on public.ai_conversations for all using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students manage own messages" on public.ai_messages for all using (
  exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.student_id = auth.uid())
) with check (
  exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.student_id = auth.uid())
);

-- Public authenticated read access to curriculum/content.
alter table public.institutions enable row level security;
alter table public.programmes enable row level security;
alter table public.academic_periods enable row level security;
alter table public.courses enable row level security;
alter table public.course_offerings enable row level security;
alter table public.topics enable row level security;
alter table public.subtopics enable row level security;
alter table public.skills enable row level security;
alter table public.topic_skills enable row level security;
alter table public.learning_units enable row level security;
alter table public.content_resources enable row level security;
alter table public.topic_resources enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.practicals enable row level security;
alter table public.practical_steps enable row level security;
alter table public.topic_relationships enable row level security;
alter table public.curriculum_sources enable row level security;

create policy "authenticated read institutions" on public.institutions for select to authenticated using (true);
create policy "authenticated read programmes" on public.programmes for select to authenticated using (true);
create policy "authenticated read academic periods" on public.academic_periods for select to authenticated using (true);
create policy "authenticated read courses" on public.courses for select to authenticated using (true);
create policy "authenticated read course offerings" on public.course_offerings for select to authenticated using (true);
create policy "authenticated read topics" on public.topics for select to authenticated using (true);
create policy "authenticated read subtopics" on public.subtopics for select to authenticated using (true);
create policy "authenticated read skills" on public.skills for select to authenticated using (true);
create policy "authenticated read topic skills" on public.topic_skills for select to authenticated using (true);
create policy "authenticated read learning units" on public.learning_units for select to authenticated using (true);
create policy "authenticated read resources" on public.content_resources for select to authenticated using (true);
create policy "authenticated read topic resources" on public.topic_resources for select to authenticated using (true);
create policy "authenticated read approved questions" on public.questions for select to authenticated using (status = 'approved');
create policy "authenticated read question options" on public.question_options for select to authenticated using (
  exists (select 1 from public.questions q where q.id = question_id and q.status = 'approved')
);
create policy "authenticated read practicals" on public.practicals for select to authenticated using (status = 'approved');
create policy "authenticated read practical steps" on public.practical_steps for select to authenticated using (
  exists (select 1 from public.practicals p where p.id = practical_id and p.status = 'approved')
);
create policy "authenticated read topic relationships" on public.topic_relationships for select to authenticated using (true);
create policy "authenticated read curriculum sources" on public.curriculum_sources for select to authenticated using (true);

-- Storage bucket for private student material uploads.
insert into storage.buckets (id, name, public)
select 'student-materials', 'student-materials', false
where not exists (select 1 from storage.buckets where id = 'student-materials');

create policy "students upload own materials"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "students read own materials"
on storage.objects for select to authenticated
using (
  bucket_id = 'student-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "students delete own materials"
on storage.objects for delete to authenticated
using (
  bucket_id = 'student-materials'
  and (storage.foldername(name))[1] = auth.uid()::text
);
