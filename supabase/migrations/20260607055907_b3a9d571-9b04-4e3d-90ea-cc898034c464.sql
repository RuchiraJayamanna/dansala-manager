DROP POLICY IF EXISTS "admins write agenda" ON public.agenda_items;
CREATE POLICY "admins write agenda" ON public.agenda_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write settings" ON public.app_settings;
CREATE POLICY "admins write settings" ON public.app_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write budget" ON public.budget_items;
CREATE POLICY "admins write budget" ON public.budget_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write receipts" ON public.budget_receipts;
CREATE POLICY "admins write receipts" ON public.budget_receipts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write checklist" ON public.checklist_items;
CREATE POLICY "admins write checklist" ON public.checklist_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write contrib" ON public.contributions;
CREATE POLICY "admins write contrib" ON public.contributions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write events" ON public.events;
CREATE POLICY "admins write events" ON public.events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write master" ON public.master_options;
CREATE POLICY "admins write master" ON public.master_options
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write staff" ON public.staff;
CREATE POLICY "admins write staff" ON public.staff
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins write members" ON public.team_members;
CREATE POLICY "admins write members" ON public.team_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;

DROP POLICY IF EXISTS "admins upload receipts" ON storage.objects;
CREATE POLICY "admins upload receipts" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins update receipts" ON storage.objects;
CREATE POLICY "admins update receipts" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins delete receipts" ON storage.objects;
CREATE POLICY "admins delete receipts" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'::public.app_role));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;