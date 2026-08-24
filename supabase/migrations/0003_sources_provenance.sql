-- StudyLab v0.2 — Phase 3: Sources & provenance
-- Every piece of content the student sees carries a 4-level source hierarchy:
--   1 — student / lecturer / university course material (their own uploads & links)
--   2 — authoritative academic source
--   3 — curated external resource (e.g. vetted videos)
--   4 — AI-generated (never presented as authoritative)
-- Adds `source_level` + `provenance` to content_resources, ingestion bookkeeping
-- to uploaded_materials, and the extracted_content table that a processor
-- (Edge Function) fills with structured items pulled from a student's documents.
--
-- Design notes:
-- * extracted_content rows are written by the server-side `process-material`
--   Edge Function (service role); students can only read rows of their own
--   materials. The original document is never modified — extraction is
--   derived, stored separately, and keeps page/confidence provenance.

-- ============================================================
-- Source hierarchy on shared content resources
-- ============================================================

alter table public.content_resources
  add column if not exists source_level integer check (source_level between 1 and 4);

alter table public.content_resources
  add column if not exists provenance jsonb not null default '{}'::jsonb;

-- ============================================================
-- Upload ingestion bookkeeping
-- ============================================================

alter table public.uploaded_materials
  add column if not exists processing_error text;

alter table public.uploaded_materials
  add column if not exists page_count integer;

-- ============================================================
-- Extracted content (derived from uploads; original untouched)
-- ============================================================

create table if not exists public.extracted_content (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.uploaded_materials(id) on delete cascade,
  item_type text not null check (item_type in (
    'heading','definition','formula','example','question',
    'objective','activity','concept','relationship'
  )),
  content text not null,
  heading text,
  source_page integer,
  confidence numeric not null default 1 check (confidence between 0 and 1),
  concept_id uuid references public.concepts(id) on delete set null,
  question_id uuid references public.questions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_extracted_content_material on public.extracted_content(material_id);
create index if not exists idx_extracted_content_concept on public.extracted_content(concept_id);
create index if not exists idx_extracted_content_question on public.extracted_content(question_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.extracted_content enable row level security;

-- Students can read extracted items for materials they own.
create policy "students read own extracted content"
  on public.extracted_content for select to authenticated
  using (
    exists (
      select 1 from public.uploaded_materials m
      where m.id = material_id and m.student_id = auth.uid()
    )
  );

-- (Insert/update/delete for extracted_content are intentionally service-role
-- only: the processor Edge Function writes rows, students never fabricate
-- "extracted from your material" content.)

-- ============================================================
-- Grants (mirror the existing grants pattern from 0001)
-- ============================================================

grant select on public.extracted_content to authenticated;
grant insert, update, delete on public.extracted_content to service_role;
