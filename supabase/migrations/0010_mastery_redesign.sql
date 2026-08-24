-- StudyLab v0.3 — Migration 0010: Mastery-Driven Learning Redesign
-- Adds columns and schemas for structured lessons, rich learning objectives,
-- textbook library categorization, resource purposes, and deep curriculum seeds.

-- 1. Topics enrichments
alter table public.topics add column if not exists overview text;
alter table public.topics add column if not exists why_it_matters text;
alter table public.topics add column if not exists prerequisites_summary text;

-- 2. Learning Objectives enrichments
alter table public.learning_objectives add column if not exists bloom_level text check (bloom_level in ('remember','understand','apply','analyze','evaluate','create'));
alter table public.learning_objectives add column if not exists criteria text;

-- 3. Learning Units enrichments
alter table public.learning_units add column if not exists concept_id uuid references public.concepts(id) on delete set null;
alter table public.learning_units add column if not exists learning_objective_id uuid references public.learning_objectives(id) on delete set null;
alter table public.learning_units add column if not exists source_id text;
alter table public.learning_units add column if not exists source_url text;
alter table public.learning_units add column if not exists source_title text;
alter table public.learning_units add column if not exists page_reference text;
alter table public.learning_units add column if not exists confidence numeric default 1;

-- 4. Content Resources enrichments
alter table public.content_resources add column if not exists category text check (category in ('my_materials','open_textbooks','university_courses','academic_websites','videos','external_libraries'));
alter table public.content_resources add column if not exists purpose text check (purpose in ('conceptual_understanding','visual_explanation','worked_examples','practice','advanced_study','exam_preparation','lab_practical'));
alter table public.content_resources add column if not exists recommendation_reason text;
alter table public.content_resources add column if not exists course_code text;
alter table public.content_resources add column if not exists page_reference text;

-- 5. Questions enrichments
alter table public.questions add column if not exists difficulty_level text check (difficulty_level in ('recognition','basic_application','multi_step','unfamiliar_problem','application_transfer'));
alter table public.questions add column if not exists context_scenario text;

create index if not exists idx_learning_units_concept on public.learning_units(concept_id);
create index if not exists idx_learning_units_obj on public.learning_units(learning_objective_id);
create index if not exists idx_resources_category on public.content_resources(category);
create index if not exists idx_resources_purpose on public.content_resources(purpose);
