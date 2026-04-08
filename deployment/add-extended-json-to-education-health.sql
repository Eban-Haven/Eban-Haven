-- Run against your Postgres/Supabase database before using extended education & health fields from the admin UI.
-- Stores JSON for program metadata, vitals, and checkup flags alongside progress_percent / general_health_score.

ALTER TABLE public.education_records
  ADD COLUMN IF NOT EXISTS extended_json text;

ALTER TABLE public.health_wellbeing_records
  ADD COLUMN IF NOT EXISTS extended_json text;
