
CREATE POLICY "anyone can read receipts" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'receipts');

CREATE POLICY "admins upload receipts" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update receipts" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete receipts" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));
