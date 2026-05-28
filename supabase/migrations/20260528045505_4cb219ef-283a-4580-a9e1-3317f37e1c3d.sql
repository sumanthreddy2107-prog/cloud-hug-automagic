
INSERT INTO storage.buckets (id, name, public) VALUES ('settings', 'settings', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Settings bucket public read" ON storage.objects FOR SELECT USING (bucket_id = 'settings');
CREATE POLICY "Settings bucket public insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'settings');
CREATE POLICY "Settings bucket public update" ON storage.objects FOR UPDATE USING (bucket_id = 'settings');
CREATE POLICY "Settings bucket public delete" ON storage.objects FOR DELETE USING (bucket_id = 'settings');
