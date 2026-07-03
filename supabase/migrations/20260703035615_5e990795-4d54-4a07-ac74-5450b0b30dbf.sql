
-- 1. Rename events.dansala_type → events.event_category
ALTER TABLE public.events RENAME COLUMN dansala_type TO event_category;

-- 2. Add generic event fields
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'LKR',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Colombo',
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_visibility_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_visibility_check CHECK (visibility IN ('public','internal','private'));

-- Backfill visibility from is_public
UPDATE public.events SET visibility = CASE WHEN is_public THEN 'public' ELSE 'private' END;

-- Keep is_public and visibility in sync via trigger
CREATE OR REPLACE FUNCTION public.sync_event_visibility()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.visibility IS DISTINCT FROM OLD.visibility THEN
    NEW.is_public := (NEW.visibility = 'public');
  ELSIF NEW.is_public IS DISTINCT FROM OLD.is_public THEN
    NEW.visibility := CASE WHEN NEW.is_public THEN 'public' ELSE 'private' END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_event_visibility_trg ON public.events;
CREATE TRIGGER sync_event_visibility_trg
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.sync_event_visibility();

-- 3. Master options: rename dansala_type → event_category, seed generic categories
UPDATE public.master_options SET option_type = 'event_category' WHERE option_type = 'dansala_type';

INSERT INTO public.master_options (option_type, value, sort_order, active)
VALUES
  ('event_category', 'Conference', 100, true),
  ('event_category', 'Workshop', 101, true),
  ('event_category', 'Wedding', 102, true),
  ('event_category', 'Community Event', 103, true),
  ('event_category', 'Fundraiser', 104, true),
  ('event_category', 'Other', 999, true)
ON CONFLICT DO NOTHING;

-- 4. event_templates table
CREATE TABLE IF NOT EXISTS public.event_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  event_category text,
  default_agenda jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_budget_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_templates TO authenticated;
GRANT ALL ON public.event_templates TO service_role;

ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read templates" ON public.event_templates;
CREATE POLICY "authenticated read templates" ON public.event_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins write templates" ON public.event_templates;
CREATE POLICY "admins write templates" ON public.event_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS event_templates_touch ON public.event_templates;
CREATE TRIGGER event_templates_touch BEFORE UPDATE ON public.event_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. RLS lockdown — replace open SELECT policies on event-scoped tables
-- Helper: readable if admin OR event is public
-- (inlined per table)

-- agenda_items
DROP POLICY IF EXISTS "public read agenda" ON public.agenda_items;
REVOKE SELECT ON public.agenda_items FROM anon;
CREATE POLICY "read agenda by visibility" ON public.agenda_items
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = agenda_items.event_id AND e.is_public = true)
  );

-- budget_items
DROP POLICY IF EXISTS "public read budget" ON public.budget_items;
REVOKE SELECT ON public.budget_items FROM anon;
CREATE POLICY "read budget by visibility" ON public.budget_items
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = budget_items.event_id AND e.is_public = true)
  );

-- budget_receipts (join through budget_items → events)
DROP POLICY IF EXISTS "public read receipts" ON public.budget_receipts;
REVOKE SELECT ON public.budget_receipts FROM anon;
CREATE POLICY "read budget receipts by visibility" ON public.budget_receipts
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.budget_items bi
      JOIN public.events e ON e.id = bi.event_id
      WHERE bi.id = budget_receipts.budget_item_id AND e.is_public = true
    )
  );

-- checklist_items
DROP POLICY IF EXISTS "public read checklist" ON public.checklist_items;
REVOKE SELECT ON public.checklist_items FROM anon;
CREATE POLICY "read checklist by visibility" ON public.checklist_items
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = checklist_items.event_id AND e.is_public = true)
  );

-- checklist_assignees (join through checklist_items)
DROP POLICY IF EXISTS "public read checklist assignees" ON public.checklist_assignees;
REVOKE SELECT ON public.checklist_assignees FROM anon;
CREATE POLICY "read checklist assignees by visibility" ON public.checklist_assignees
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.checklist_items ci
      JOIN public.events e ON e.id = ci.event_id
      WHERE ci.id = checklist_assignees.checklist_item_id AND e.is_public = true
    )
  );

-- contributions
DROP POLICY IF EXISTS "public read contrib" ON public.contributions;
REVOKE SELECT ON public.contributions FROM anon;
CREATE POLICY "read contrib by visibility" ON public.contributions
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = contributions.event_id AND e.is_public = true)
  );

-- contribution_receipts
DROP POLICY IF EXISTS "public read contrib receipts" ON public.contribution_receipts;
REVOKE SELECT ON public.contribution_receipts FROM anon;
CREATE POLICY "read contrib receipts by visibility" ON public.contribution_receipts
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.contributions c
      JOIN public.events e ON e.id = c.event_id
      WHERE c.id = contribution_receipts.contribution_id AND e.is_public = true
    )
  );

-- event_documents
DROP POLICY IF EXISTS "read event docs" ON public.event_documents;
REVOKE SELECT ON public.event_documents FROM anon;
CREATE POLICY "read event docs by visibility" ON public.event_documents
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_documents.event_id AND e.is_public = true)
  );

-- item_checklist
DROP POLICY IF EXISTS "read item checklist" ON public.item_checklist;
REVOKE SELECT ON public.item_checklist FROM anon;
CREATE POLICY "read item checklist by visibility" ON public.item_checklist
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = item_checklist.event_id AND e.is_public = true)
  );

-- team_members
DROP POLICY IF EXISTS "public read team" ON public.team_members;
DROP POLICY IF EXISTS "public read team_members" ON public.team_members;
REVOKE SELECT ON public.team_members FROM anon;
CREATE POLICY "read team by visibility" ON public.team_members
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.events e WHERE e.id = team_members.event_id AND e.is_public = true)
  );

-- Also lock down events SELECT for anon (was public,anon)
DROP POLICY IF EXISTS "read events by visibility" ON public.events;
CREATE POLICY "read events by visibility" ON public.events
  FOR SELECT TO authenticated USING (
    is_public = true OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- staff, master_options, app_settings: keep readable to authenticated only
REVOKE SELECT ON public.staff FROM anon;
REVOKE SELECT ON public.master_options FROM anon;
REVOKE SELECT ON public.app_settings FROM anon;
