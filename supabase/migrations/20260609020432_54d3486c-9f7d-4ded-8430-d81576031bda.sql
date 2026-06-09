
-- 1. checklist_assignees
CREATE TABLE public.checklist_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id uuid NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_item_id, staff_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_assignees TO authenticated;
GRANT SELECT ON public.checklist_assignees TO anon;
GRANT ALL ON public.checklist_assignees TO service_role;
ALTER TABLE public.checklist_assignees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read checklist assignees" ON public.checklist_assignees FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write checklist assignees" ON public.checklist_assignees
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. contribution_receipts
CREATE TABLE public.contribution_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES public.contributions(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contribution_receipts TO authenticated;
GRANT SELECT ON public.contribution_receipts TO anon;
GRANT ALL ON public.contribution_receipts TO service_role;
ALTER TABLE public.contribution_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read contrib receipts" ON public.contribution_receipts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write contrib receipts" ON public.contribution_receipts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. events.office_contribution
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS office_contribution numeric NOT NULL DEFAULT 0;
