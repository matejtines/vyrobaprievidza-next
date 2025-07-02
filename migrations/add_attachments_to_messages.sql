-- Pridanie stĺpcov pre prílohy do tabuľky messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- Vytvorenie bucket pre chat prílohy
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS politiky pre storage bucket
CREATE POLICY "Povoliť čítanie chat príloh" ON storage.objects
FOR SELECT USING (bucket_id = 'chat-attachments');

CREATE POLICY "Povoliť nahrávanie chat príloh" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Povoliť mazanie vlastných chat príloh" ON storage.objects
FOR DELETE USING (bucket_id = 'chat-attachments' AND auth.uid() = owner); 