
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ EVENTS ============
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL,
  location text,
  dansala_type text,
  event_date date,
  status text NOT NULL DEFAULT 'Planning',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon, authenticated;
GRANT ALL ON public.events TO authenticated, service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read events" ON public.events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write events" ON public.events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER events_touch BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed a default event from existing data
INSERT INTO public.events (id, name, year, location, dansala_type, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dansala 2026', 2026, 'Head Office', 'Sandwich Dansala', 'Active');

-- ============ APP SETTINGS ============
CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text NOT NULL DEFAULT 'Dansala Management System',
  current_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (id = 1)
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO authenticated, service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER settings_touch BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
INSERT INTO public.app_settings (id, company_name, current_event_id) VALUES (1, 'Dansala Management System', '00000000-0000-0000-0000-000000000001');

-- ============ MIGRATE EXISTING TABLES ============
-- Add event_id to all transactional tables and assign to default event
ALTER TABLE public.budget_items ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;
UPDATE public.budget_items SET event_id = '00000000-0000-0000-0000-000000000001' WHERE event_id IS NULL;
ALTER TABLE public.budget_items ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE public.checklist_items ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;
UPDATE public.checklist_items SET event_id = '00000000-0000-0000-0000-000000000001' WHERE event_id IS NULL;
ALTER TABLE public.checklist_items ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE public.team_members ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;
UPDATE public.team_members SET event_id = '00000000-0000-0000-0000-000000000001' WHERE event_id IS NULL;
ALTER TABLE public.team_members ALTER COLUMN event_id SET NOT NULL;

ALTER TABLE public.contributions ADD COLUMN event_id uuid REFERENCES public.events(id) ON DELETE CASCADE;
UPDATE public.contributions SET event_id = '00000000-0000-0000-0000-000000000001' WHERE event_id IS NULL;
ALTER TABLE public.contributions ALTER COLUMN event_id SET NOT NULL;

-- Budget: quantity x rate columns + receipts link + category FK
ALTER TABLE public.budget_items
  ADD COLUMN unit text,
  ADD COLUMN actual_qty numeric,
  ADD COLUMN actual_unit_price numeric;

-- Checklist: owner becomes staff FK
ALTER TABLE public.checklist_items ADD COLUMN owner_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

-- ============ AGENDA ============
CREATE TABLE public.agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  start_time time,
  end_time time,
  title text NOT NULL,
  location text,
  responsible_staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.agenda_items TO anon, authenticated;
GRANT ALL ON public.agenda_items TO authenticated, service_role;
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read agenda" ON public.agenda_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write agenda" ON public.agenda_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER agenda_touch BEFORE UPDATE ON public.agenda_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ BUDGET RECEIPTS ============
CREATE TABLE public.budget_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id uuid NOT NULL REFERENCES public.budget_items(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.budget_receipts TO anon, authenticated;
GRANT ALL ON public.budget_receipts TO authenticated, service_role;
ALTER TABLE public.budget_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read receipts" ON public.budget_receipts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write receipts" ON public.budget_receipts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ REOPEN POLICIES FOR PUBLIC READ + ADMIN WRITE ============
-- Replace the broad "auth manage X" policies with public read + admin write
DROP POLICY IF EXISTS "auth manage budget" ON public.budget_items;
DROP POLICY IF EXISTS "auth manage checklist" ON public.checklist_items;
DROP POLICY IF EXISTS "auth manage contrib" ON public.contributions;
DROP POLICY IF EXISTS "auth manage master_options" ON public.master_options;
DROP POLICY IF EXISTS "auth manage staff" ON public.staff;
DROP POLICY IF EXISTS "auth manage members" ON public.team_members;

GRANT SELECT ON public.budget_items, public.checklist_items, public.contributions,
  public.master_options, public.staff, public.team_members TO anon;

CREATE POLICY "public read budget" ON public.budget_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write budget" ON public.budget_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read checklist" ON public.checklist_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write checklist" ON public.checklist_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read contrib" ON public.contributions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write contrib" ON public.contributions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read master" ON public.master_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write master" ON public.master_options FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read staff" ON public.staff FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write staff" ON public.staff FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "public read members" ON public.team_members FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write members" ON public.team_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SEED MASTER DATA ============
INSERT INTO public.master_options (option_type, value, sort_order) VALUES
  ('dansala_type', 'Sandwich Dansala', 1),
  ('dansala_type', 'Morning Dansala (Heel Dansala)', 2),
  ('dansala_type', 'Lunch Dansala (Dawal Dansala)', 3),
  ('dansala_type', 'Gilan Pasa', 4),
  ('dansala_type', 'Beverage Dansala', 5),
  ('unit', 'kg', 1),
  ('unit', 'g', 2),
  ('unit', 'L', 3),
  ('unit', 'ml', 4),
  ('unit', 'pcs', 5),
  ('unit', 'pack', 6),
  ('unit', 'loaf', 7),
  ('unit', 'bundle', 8),
  ('designation', 'Manager', 1),
  ('designation', 'Engineer', 2),
  ('designation', 'Executive', 3),
  ('designation', 'Assistant', 4),
  ('event_status', 'Planning', 1),
  ('event_status', 'Active', 2),
  ('event_status', 'Completed', 3)
ON CONFLICT DO NOTHING;
