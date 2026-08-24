-- StudyLab v0.2 — authors can see their own draft/review rows.
--
-- The 0001 read policy on questions exposes only status = 'approved' to all
-- students. That is correct for other people's drafts, but it also hides a
-- student's OWN draft questions from them — breaking the
-- author → practise → test-your-own-assessment loop (and making the
-- "include own drafts" query option a silent no-op).
--
-- Widen visibility to: published for everyone, plus anything the author
-- created. All other student data remains owner-scoped as before.

drop policy if exists "authenticated read approved questions" on public.questions;

create policy "authenticated read approved or own questions"
  on public.questions for select to authenticated
  using (status = 'approved' or created_by = auth.uid());

drop policy if exists "authenticated read published assessments" on public.assessments;

create policy "authenticated read published or own assessments"
  on public.assessments for select to authenticated
  using (status in ('review', 'approved') or created_by = auth.uid());
