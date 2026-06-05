
-- Master options table: holds dropdown options for any "type"
CREATE TABLE public.master_options (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_type text NOT NULL,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(option_type, value)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_options TO authenticated;
GRANT ALL ON public.master_options TO service_role;
ALTER TABLE public.master_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage master_options" ON public.master_options FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_master_options_updated BEFORE UPDATE ON public.master_options FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Staff master
CREATE TABLE public.staff (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  employee_no text,
  department text,
  designation text,
  contact text,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff TO authenticated;
GRANT ALL ON public.staff TO service_role;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage staff" ON public.staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Link team_members & contributions to staff (nullable for backward compat)
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.contributions ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL;

-- Seed default master options
INSERT INTO public.master_options (option_type, value, sort_order) VALUES
('budget_category','Paste',1),('budget_category','Bread',2),('budget_category','Materials',3),('budget_category','Team',4),('budget_category','General',5),
('phase','Preparation',1),('phase','Dansala Day',2),
('team_group','Team 1 - Pasting',1),('team_group','Team 2 - Cutting',2),('team_group','Team 3 - Packing',3),('team_group','Team 4 - Distribution',4),('team_group','Logistics',5),
('checklist_status','Pending',1),('checklist_status','In Progress',2),('checklist_status','Done',3),('checklist_status','Blocked',4),
('contribution_status','Pending',1),('contribution_status','Paid',2),('contribution_status','Waived',3),
('department','ENG',1),('department','SOL',2),('department','QA',3),('department','HR',4),('department','IT',5),('department','Finance',6),
('contribution_team','SOL',1),('contribution_team','ENG',2),('contribution_team','QA',3),
('member_role','Lead',1),('member_role','Member',2),('member_role','Coordinator',3);
