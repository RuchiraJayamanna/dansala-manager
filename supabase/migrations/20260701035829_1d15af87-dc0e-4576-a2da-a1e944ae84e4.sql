
CREATE POLICY "read event-documents" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'event-documents');

CREATE POLICY "admin upload event-documents" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin update event-documents" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'event-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete event-documents" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'event-documents' AND public.has_role(auth.uid(), 'admin'));
