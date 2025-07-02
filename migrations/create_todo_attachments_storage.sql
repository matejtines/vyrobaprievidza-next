-- Vytvorenie bucket pre todo prílohy
INSERT INTO storage.buckets (id, name, public) 
VALUES ('todoattachments', 'todoattachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS politiky pre storage bucket todoattachments
CREATE POLICY "Povoliť čítanie todo príloh" ON storage.objects
FOR SELECT USING (bucket_id = 'todoattachments');

CREATE POLICY "Povoliť nahrávanie todo príloh" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'todoattachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Povoliť mazanie vlastných todo príloh" ON storage.objects
FOR DELETE USING (bucket_id = 'todoattachments' AND auth.uid() = owner); 