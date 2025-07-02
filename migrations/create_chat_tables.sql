-- Vymazanie existujúcich tabuliek ak existujú
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_participants CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;

-- Vytvorenie tabuľky pre chat konverzácie
CREATE TABLE IF NOT EXISTS chat_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT, -- NULL pre individuálne konverzácie, názov pre skupiny
    type TEXT NOT NULL CHECK (type IN ('direct', 'group')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Vytvorenie tabuľky pre účastníkov konverzácií
CREATE TABLE IF NOT EXISTS chat_participants (
    conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    last_read_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (conversation_id, user_id)
);

-- Vytvorenie tabuľky pre správy
CREATE TABLE chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  reactions JSONB DEFAULT '{}'::jsonb,
  read_by UUID[] DEFAULT '{}'::uuid[],
  reply_to_id UUID REFERENCES chat_messages(id) ON DELETE SET NULL
);

-- Vytvorenie indexov pre rýchlejšie vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_conversation ON chat_participants(conversation_id);
CREATE INDEX idx_chat_messages_conversation_id ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_reply_to_id ON chat_messages(reply_to_id);

-- RLS policies pre chat_conversations
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Povoliť čítanie konverzácií pre účastníkov"
    ON chat_conversations FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_participants
            WHERE conversation_id = id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Povoliť vytváranie konverzácií pre prihlásených používateľov"
    ON chat_conversations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Povoliť úpravu konverzácií pre adminov skupiny"
    ON chat_conversations FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_participants
            WHERE conversation_id = id 
            AND user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- RLS policies pre chat_participants
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Povoliť čítanie účastníkov pre členov konverzácie" ON chat_participants;
DROP POLICY IF EXISTS "Povoliť pridávanie účastníkov pre adminov skupiny" ON chat_participants;
DROP POLICY IF EXISTS "Povoliť odstránenie účastníkov pre adminov skupiny" ON chat_participants;

CREATE POLICY "Povoliť čítanie účastníkov pre členov konverzácie"
    ON chat_participants FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = conversation_id 
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM chat_participants p
                    WHERE p.conversation_id = c.id
                    AND p.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "Povoliť pridávanie účastníkov pre adminov skupiny"
    ON chat_participants FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = conversation_id 
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM chat_participants p
                    WHERE p.conversation_id = c.id
                    AND p.user_id = auth.uid()
                    AND p.role = 'admin'
                )
            )
        )
    );

CREATE POLICY "Povoliť odstránenie účastníkov pre adminov skupiny"
    ON chat_participants FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM chat_conversations c
            WHERE c.id = conversation_id 
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM chat_participants p
                    WHERE p.conversation_id = c.id
                    AND p.user_id = auth.uid()
                    AND p.role = 'admin'
                )
            )
        )
    );

-- Funkcia pre automatické pridanie účastníkov do priamej konverzácie
CREATE OR REPLACE FUNCTION create_direct_conversation(user1_id UUID, user2_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_conversation_id UUID;
BEGIN
    -- Vytvorenie novej konverzácie
    INSERT INTO chat_conversations (type, created_by)
    VALUES ('direct', user1_id)
    RETURNING id INTO new_conversation_id;

    -- Pridanie oboch používateľov ako účastníkov
    INSERT INTO chat_participants (conversation_id, user_id, role)
    VALUES 
        (new_conversation_id, user1_id, 'member'),
        (new_conversation_id, user2_id, 'member');

    RETURN new_conversation_id;
END;
$$;

-- Funkcia pre vytvorenie skupinovej konverzácie
CREATE OR REPLACE FUNCTION create_group_conversation(
    group_name TEXT,
    creator_id UUID,
    initial_members UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_conversation_id UUID;
BEGIN
    -- Vytvorenie novej skupinovej konverzácie
    INSERT INTO chat_conversations (name, type, created_by)
    VALUES (group_name, 'group', creator_id)
    RETURNING id INTO new_conversation_id;

    -- Pridanie všetkých členov (creator ako admin)
    INSERT INTO chat_participants (conversation_id, user_id, role)
    SELECT 
        new_conversation_id,
        unnest(initial_members),
        CASE WHEN unnest(initial_members) = creator_id THEN 'admin' ELSE 'member' END;

    RETURN new_conversation_id;
END;
$$;

-- Trigger pre aktualizáciu updated_at v konverzáciách
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE chat_conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_timestamp
    AFTER INSERT OR UPDATE ON chat_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp(); 