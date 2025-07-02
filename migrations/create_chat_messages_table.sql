-- Vytvorenie tabuľky pre chat správy
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    content TEXT NOT NULL
);

-- Vytvorenie indexu pre rýchlejšie vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Nastavenie RLS (Row Level Security)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Vytvorenie policy pre čítanie správ (každý prihlásený používateľ môže čítať správy)
CREATE POLICY "Povoliť čítanie správ pre prihlásených používateľov"
    ON chat_messages FOR SELECT
    TO authenticated
    USING (true);

-- Vytvorenie policy pre pridávanie správ (každý prihlásený používateľ môže pridávať správy)
CREATE POLICY "Povoliť pridávanie správ pre prihlásených používateľov"
    ON chat_messages FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Vytvorenie policy pre mazanie správ (používateľ môže mazať len svoje správy)
CREATE POLICY "Povoliť mazanie vlastných správ"
    ON chat_messages FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id); 