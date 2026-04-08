-- Optional: add columns expected by EbanHaven.Api EF entities for admin grid fields.
-- Run against the same Postgres database that backs HavenDbContext (public.supporters, public.residents).
-- Safe to run multiple times.

ALTER TABLE public.supporters ADD COLUMN IF NOT EXISTS relationship_type text;

ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS present_age text;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS length_of_stay text;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS current_risk_level text;
