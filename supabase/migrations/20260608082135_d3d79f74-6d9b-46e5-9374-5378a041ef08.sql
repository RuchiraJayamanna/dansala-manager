ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS checklist_notes text,
  ADD COLUMN IF NOT EXISTS team_notes jsonb NOT NULL DEFAULT '{}'::jsonb;