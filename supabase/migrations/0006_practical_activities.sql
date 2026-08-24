-- StudyLab v0.2 — Phase 9: Practical learning activity attempts
-- Quick guided activities (equation balancer, break-even calculator, unit
-- converter, rate-of-change checker, …) are deterministic built-ins from
-- src/lib/practical-activities.ts. Completions are recorded here so practice
-- history is real and queryable — nothing is faked in the UI.

create table if not exists public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  activity_type text not null,
  subject text,
  scenario jsonb not null default '{}'::jsonb,
  answer jsonb not null default '{}'::jsonb,
  is_correct boolean,
  score numeric check (score between 0 and 100),
  time_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_attempts_student
  on public.activity_attempts(student_id, created_at desc);
create index if not exists idx_activity_attempts_type on public.activity_attempts(activity_type);

alter table public.activity_attempts enable row level security;

create policy "students manage own activity attempts"
  on public.activity_attempts for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

grant select, insert, update, delete on public.activity_attempts to authenticated;
grant select, insert, update, delete on public.activity_attempts to service_role;
