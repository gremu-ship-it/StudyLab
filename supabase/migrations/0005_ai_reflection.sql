-- StudyLab v0.2 — Phase 8: AI reflection (Feynman explain-back)
-- Students explain a topic/concept in their own words. The response is
-- stored immediately; the server-side `ai-tutor` Edge Function evaluates it
-- and writes ai_feedback + score back (see 0005 grant for service_role).
-- Until evaluation runs, score is null and the UI shows "evaluation
-- pending" — no fake scores.

create table if not exists public.explain_back_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student_profiles(id) on delete cascade,
  topic_id uuid references public.topics(id) on delete set null,
  concept_id uuid references public.concepts(id) on delete set null,
  prompt text not null,
  student_response text not null,
  ai_feedback jsonb,
  score numeric check (score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_explain_back_student
  on public.explain_back_attempts(student_id, created_at desc);
create index if not exists idx_explain_back_topic on public.explain_back_attempts(topic_id);
create index if not exists idx_explain_back_concept on public.explain_back_attempts(concept_id);

do $$
begin
  drop trigger if exists explain_back_attempts_updated_at on public.explain_back_attempts;
  create trigger explain_back_attempts_updated_at
    before update on public.explain_back_attempts
    for each row execute function public.set_updated_at();
end $$;

alter table public.explain_back_attempts enable row level security;

create policy "students manage own explain-back attempts"
  on public.explain_back_attempts for all to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid());

grant select, insert, update, delete on public.explain_back_attempts to authenticated;
grant select, insert, update, delete on public.explain_back_attempts to service_role;
