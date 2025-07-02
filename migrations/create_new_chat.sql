-- Vymazanie existujúcich tabuliek
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;

-- Vymazanie existujúcich typov
DROP TYPE IF EXISTS conversation_type CASCADE;
DROP TYPE IF EXISTS participant_role CASCADE;

-- Vymazanie existujúcich funkcií
DROP FUNCTION IF EXISTS get_user_conversations(UUID) CASCADE;
DROP FUNCTION IF EXISTS create_direct_conversation(UUID) CASCADE;
DROP FUNCTION IF EXISTS create_group_conversation(TEXT, UUID[]) CASCADE;
DROP FUNCTION IF EXISTS update_conversation_timestamp() CASCADE;
DROP FUNCTION IF EXISTS delete_conversation(UUID) CASCADE;
DROP FUNCTION IF EXISTS mark_messages_as_read(UUID, UUID) CASCADE;

-- Vytvorenie typov
CREATE TYPE conversation_type AS ENUM ('direct', 'group');
CREATE TYPE participant_role AS ENUM ('member', 'admin');

-- Vytvorenie tabuľky pre konverzácie
CREATE TABLE conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT,  -- NULL pre priame správy, názov pre skupiny
    type conversation_type NOT NULL DEFAULT 'direct',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    last_message_at TIMESTAMPTZ,
    last_message_text TEXT,
    last_message_sender_id UUID REFERENCES auth.users(id)
);

-- Vytvorenie tabuľky pre účastníkov
CREATE TABLE conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    role participant_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_read_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);

-- Vytvorenie tabuľky pre správy
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    user_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT false,
    reactions JSONB DEFAULT '{}'::jsonb,
    read_by UUID[] DEFAULT '{}'::uuid[],
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_type TEXT
);

-- Indexy pre rýchlejšie vyhľadávanie
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_conversation_participants_user_id ON conversation_participants(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at);

-- Trigger na aktualizáciu updated_at v konverzácii a user_name v správe
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
DECLARE
    v_user_name TEXT;
BEGIN
    -- Získanie user_name z profiles tabuľky
    SELECT COALESCE(name, email) INTO v_user_name
    FROM profiles
    WHERE id = NEW.user_id;

    -- Aktualizácia user_name v správe
    NEW.user_name := v_user_name;

    -- Aktualizácia konverzácie
    UPDATE conversations 
    SET 
        updated_at = NEW.created_at,
        last_message_at = NEW.created_at,
        last_message_text = NEW.content,
        last_message_sender_id = NEW.user_id
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_timestamp_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- RLS politiky
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Politiky pre conversations
CREATE POLICY "Povoliť čítanie konverzácií pre účastníkov"
    ON conversations FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Povoliť vytvorenie konverzácie"
    ON conversations FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Povoliť úpravu konverzácie pre adminov"
    ON conversations FOR UPDATE
    TO authenticated
    USING (
        id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Politiky pre conversation_participants
CREATE POLICY "Povoliť čítanie účastníkov"
    ON conversation_participants FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Povoliť pridanie účastníka pre adminov"
    ON conversation_participants FOR INSERT
    TO authenticated
    WITH CHECK (
        conversation_id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "Povoliť úpravu účastníka pre adminov"
    ON conversation_participants FOR UPDATE
    TO authenticated
    USING (
        conversation_id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    )
    WITH CHECK (
        conversation_id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Politiky pre messages
CREATE POLICY "Povoliť čítanie správ pre účastníkov konverzácie"
    ON messages FOR SELECT
    TO authenticated
    USING (
        conversation_id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Povoliť odoslanie správy pre účastníkov konverzácie"
    ON messages FOR INSERT
    TO authenticated
    WITH CHECK (
        conversation_id IN (
            SELECT conversation_id 
            FROM conversation_participants 
            WHERE user_id = auth.uid()
        )
        AND user_id = auth.uid()
    );

CREATE POLICY "Povoliť úpravu vlastných správ"
    ON messages FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Funkcia na získanie konverzácií používateľa
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    type conversation_type,
    last_message TEXT,
    last_message_time TIMESTAMPTZ,
    unread_count BIGINT,
    participants JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH conversation_data AS (
        SELECT 
            c.id,
            CASE 
                WHEN c.type = 'direct' THEN (
                    SELECT CASE 
                        WHEN pr.name IS NOT NULL AND pr.login IS NOT NULL THEN pr.login || ' ' || pr.name
                        WHEN pr.name IS NOT NULL THEN pr.name
                        WHEN pr.login IS NOT NULL THEN pr.login
                        ELSE pr.email
                    END
                    FROM conversation_participants p
                    LEFT JOIN profiles pr ON pr.id = p.user_id
                    WHERE p.conversation_id = c.id
                    AND p.user_id != p_user_id
                    LIMIT 1
                )
                ELSE c.name
            END as name,
            c.type,
            c.updated_at,
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', p.user_id,
                        'name', CASE 
                            WHEN pr.name IS NOT NULL AND pr.login IS NOT NULL THEN pr.login || ' ' || pr.name
                            WHEN pr.name IS NOT NULL THEN pr.name
                            WHEN pr.login IS NOT NULL THEN pr.login
                            ELSE pr.email
                        END,
                        'role', p.role
                    )
                )
                FROM conversation_participants p
                LEFT JOIN profiles pr ON pr.id = p.user_id
                WHERE p.conversation_id = c.id
            ) as participants,
            (
                SELECT m.content
                FROM messages m
                WHERE m.conversation_id = c.id
                AND m.is_deleted = false
                ORDER BY m.created_at DESC
                LIMIT 1
            ) as last_message,
            (
                SELECT m.created_at
                FROM messages m
                WHERE m.conversation_id = c.id
                AND m.is_deleted = false
                ORDER BY m.created_at DESC
                LIMIT 1
            ) as last_message_time,
            (
                SELECT COUNT(*)
                FROM messages m
                WHERE m.conversation_id = c.id
                AND m.is_deleted = false
                AND m.user_id != p_user_id
                AND NOT (p_user_id = ANY(m.read_by))
            ) as unread_count
        FROM conversations c
        INNER JOIN conversation_participants p ON p.conversation_id = c.id
        WHERE p.user_id = p_user_id
    )
    SELECT 
        cd.id,
        cd.name,
        cd.type,
        cd.last_message,
        cd.last_message_time,
        cd.unread_count,
        cd.participants
    FROM conversation_data cd
    ORDER BY cd.last_message_time DESC NULLS LAST;
END;
$$;

-- Pridanie oprávnení pre funkciu
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_conversations(UUID) TO service_role;

-- Funkcia na vytvorenie priamej konverzácie
CREATE OR REPLACE FUNCTION create_direct_conversation(
    p_other_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conversation_id UUID;
    v_existing_conversation_id UUID;
BEGIN
    -- Kontrola či už existuje priama konverzácia
    SELECT c.id INTO v_existing_conversation_id
    FROM conversations c
    JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
    JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
    WHERE c.type = 'direct'
    AND cp1.user_id = auth.uid()
    AND cp2.user_id = p_other_user_id
    LIMIT 1;

    IF v_existing_conversation_id IS NOT NULL THEN
        RETURN v_existing_conversation_id;
    END IF;

    -- Vytvorenie novej konverzácie
    INSERT INTO conversations (type, created_by)
    VALUES ('direct', auth.uid())
    RETURNING id INTO v_conversation_id;

    -- Pridanie účastníkov
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES 
        (v_conversation_id, auth.uid(), 'member'),
        (v_conversation_id, p_other_user_id, 'member');

    RETURN v_conversation_id;
END;
$$;

-- Funkcia na vytvorenie skupinovej konverzácie
CREATE OR REPLACE FUNCTION create_group_conversation(
    p_name TEXT,
    p_participant_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_conversation_id UUID;
    v_participant_id UUID;
BEGIN
    -- Vytvorenie konverzácie
    INSERT INTO conversations (name, type, created_by)
    VALUES (p_name, 'group', auth.uid())
    RETURNING id INTO v_conversation_id;

    -- Pridanie účastníkov
    -- Najprv pridáme vytvárajúceho používateľa ako admina
    INSERT INTO conversation_participants (conversation_id, user_id, role)
    VALUES (v_conversation_id, auth.uid(), 'admin');

    -- Potom pridáme ostatných účastníkov ako členov
    FOREACH v_participant_id IN ARRAY p_participant_ids
    LOOP
        IF v_participant_id != auth.uid() THEN
            INSERT INTO conversation_participants (conversation_id, user_id, role)
            VALUES (v_conversation_id, v_participant_id, 'member');
        END IF;
    END LOOP;

    RETURN v_conversation_id;
END;
$$;

-- Funkcia na vymazanie konverzácie
CREATE OR REPLACE FUNCTION delete_conversation(p_conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
    v_conversation_type conversation_type;
    v_is_participant BOOLEAN;
BEGIN
    -- Získame ID aktuálneho používateľa
    v_user_id := auth.uid();
    
    -- Získame typ konverzácie a či je používateľ účastníkom
    SELECT 
        c.type,
        EXISTS (
            SELECT 1 
            FROM conversation_participants 
            WHERE conversation_id = p_conversation_id 
            AND user_id = v_user_id
        )
    INTO v_conversation_type, v_is_participant
    FROM conversations c
    WHERE c.id = p_conversation_id;
    
    -- Ak používateľ nie je účastníkom, vyhodíme chybu
    IF NOT v_is_participant THEN
        RAISE EXCEPTION 'Nie ste účastníkom tejto konverzácie';
    END IF;
    
    -- Pre skupinové konverzácie kontrolujeme admin práva
    IF v_conversation_type = 'group' THEN
        SELECT EXISTS (
            SELECT 1 
            FROM conversation_participants 
            WHERE conversation_id = p_conversation_id 
            AND user_id = v_user_id 
            AND role = 'admin'
        ) INTO v_is_admin;
        
        IF NOT v_is_admin THEN
            RAISE EXCEPTION 'Nemáte oprávnenie na vymazanie tejto skupinovej konverzácie';
        END IF;
    END IF;
    
    -- Vymažeme konverzáciu (cascade vymaže aj správy a účastníkov)
    DELETE FROM conversations WHERE id = p_conversation_id;
END;
$$;

-- Povolíme vykonávanie funkcie pre autentizovaných používateľov
GRANT EXECUTE ON FUNCTION delete_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_group_conversation(TEXT, UUID[]) TO authenticated;

-- Funkcia na označenie správ ako prečítané
CREATE OR REPLACE FUNCTION mark_messages_as_read(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Označíme všetky správy v konverzácii ako prečítané pre daného používateľa
    UPDATE messages 
    SET read_by = array_append(read_by, p_user_id)
    WHERE conversation_id = p_conversation_id
    AND user_id != p_user_id
    AND NOT (p_user_id = ANY(read_by));
END;
$$;

-- Pridanie oprávnení pre funkciu
GRANT EXECUTE ON FUNCTION mark_messages_as_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_as_read(UUID, UUID) TO service_role; 