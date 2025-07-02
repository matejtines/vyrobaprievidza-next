-- Pridanie stĺpcov pre reakcie a prečítanie správ
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS read_by TEXT[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Vytvorenie indexu pre rýchlejšie vyhľadávanie prečítaných správ
CREATE INDEX IF NOT EXISTS idx_chat_messages_read_by ON chat_messages USING GIN (read_by);

-- Aktualizácia RLS policies
DROP POLICY IF EXISTS "Povoliť čítanie správ pre prihlásených používateľov" ON chat_messages;
DROP POLICY IF EXISTS "Povoliť pridávanie správ pre prihlásených používateľov" ON chat_messages;
DROP POLICY IF EXISTS "Povoliť mazanie vlastných správ" ON chat_messages;

-- Nové policies s podporou pre reakcie a prečítanie
CREATE POLICY "Povoliť čítanie správ pre prihlásených používateľov"
    ON chat_messages FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Povoliť pridávanie správ pre prihlásených používateľov"
    ON chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Povoliť aktualizáciu vlastných správ"
    ON chat_messages FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = user_id::text)
    WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Povoliť mazanie vlastných správ"
    ON chat_messages FOR DELETE
    TO authenticated
    USING (auth.uid()::text = user_id::text);

-- Pridanie triggeru pre automatické čistenie prázdnych reakcií
CREATE OR REPLACE FUNCTION clean_empty_reactions()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.reactions = '{}'::jsonb THEN
        NEW.reactions = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clean_empty_reactions_trigger ON chat_messages;
CREATE TRIGGER clean_empty_reactions_trigger
    BEFORE UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION clean_empty_reactions(); 