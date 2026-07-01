
-- 1) Events: is_public
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Replace SELECT policy so non-admins only see public events
DROP POLICY IF EXISTS "public read events" ON public.events;
CREATE POLICY "read events by visibility" ON public.events
FOR SELECT USING (is_public = true OR public.has_role(auth.uid(), 'admin'));

-- 2) Contributions: payment_type
ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'Online';

-- 3) event_documents
CREATE TABLE IF NOT EXISTS public.event_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_documents TO authenticated;
GRANT SELECT ON public.event_documents TO anon;
GRANT ALL ON public.event_documents TO service_role;

ALTER TABLE public.event_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read event docs" ON public.event_documents FOR SELECT USING (true);
CREATE POLICY "admin write event docs" ON public.event_documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS event_documents_event_idx ON public.event_documents(event_id);

-- 4) item_checklist
CREATE TABLE IF NOT EXISTS public.item_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text,
  responsible_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  responsible_name text,
  status text NOT NULL DEFAULT 'Pending',
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_checklist TO authenticated;
GRANT SELECT ON public.item_checklist TO anon;
GRANT ALL ON public.item_checklist TO service_role;

ALTER TABLE public.item_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read item checklist" ON public.item_checklist FOR SELECT USING (true);
CREATE POLICY "admin write item checklist" ON public.item_checklist FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER item_checklist_touch BEFORE UPDATE ON public.item_checklist
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS item_checklist_event_idx ON public.item_checklist(event_id);
