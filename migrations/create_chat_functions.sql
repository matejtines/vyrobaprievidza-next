-- Vymazanie existujúcich funkcií
DROP FUNCTION IF EXISTS get_user_conversations(UUID) CASCADE;
DROP FUNCTION IF EXISTS create_direct_conversation(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS create_group_conversation(UUID, TEXT, UUID[]) CASCADE;
DROP FUNCTION IF EXISTS update_conversation_timestamp() CASCADE;

-- Funkcia na získanie konverzácií používateľa
CREATE OR REPLACE FUNCTION get_user_conversations(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
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
      c.name,
      c.type,
      c.updated_at,
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', p.user_id,
            'name', COALESCE(pr.name, pr.email),
            'role', p.role
          )
        )
        FROM chat_participants p
        LEFT JOIN profiles pr ON pr.id = p.user_id
        WHERE p.conversation_id = c.id
      ) as participants,
      (
        SELECT m.content
        FROM chat_messages m
        WHERE m.conversation_id = c.id
        AND m.is_deleted = false
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_message,
      (
        SELECT m.created_at
        FROM chat_messages m
        WHERE m.conversation_id = c.id
        AND m.is_deleted = false
        ORDER BY m.created_at DESC
        LIMIT 1
      ) as last_message_time,
      (
        SELECT COUNT(*)
        FROM chat_messages m
        WHERE m.conversation_id = c.id
        AND m.is_deleted = false
        AND m.user_id != p_user_id
        AND NOT (p_user_id = ANY(m.read_by))
      ) as unread_count
    FROM chat_conversations c
    INNER JOIN chat_participants p ON p.conversation_id = c.id
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
DROP FUNCTION IF EXISTS create_direct_conversation(uuid, uuid);

CREATE OR REPLACE FUNCTION create_direct_conversation(
    p_user_id UUID,  -- ID používateľa, ktorý vytvára konverzáciu
    p_other_user_id UUID  -- ID druhého používateľa
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_existing_conversation_id UUID;
BEGIN
  -- Kontrola či už existuje priama konverzácia medzi používateľmi
  SELECT c.id INTO v_existing_conversation_id
  FROM chat_conversations c
  INNER JOIN chat_participants p1 ON p1.conversation_id = c.id
  INNER JOIN chat_participants p2 ON p2.conversation_id = c.id
  WHERE c.type = 'direct'
  AND p1.user_id = p_user_id
  AND p2.user_id = p_other_user_id
  LIMIT 1;

  IF v_existing_conversation_id IS NOT NULL THEN
    RETURN v_existing_conversation_id;
  END IF;

  -- Vytvorenie novej konverzácie
  INSERT INTO chat_conversations (type, created_by)
  VALUES ('direct', p_user_id)
  RETURNING id INTO v_conversation_id;

  -- Pridanie účastníkov
  INSERT INTO chat_participants (conversation_id, user_id, role)
  VALUES 
    (v_conversation_id, p_user_id, 'member'),
    (v_conversation_id, p_other_user_id, 'member');

  RETURN v_conversation_id;
END;
$$;

-- Funkcia na vytvorenie skupinovej konverzácie
CREATE OR REPLACE FUNCTION create_group_conversation(
  p_user_id UUID,
  p_name TEXT,
  p_participant_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_participant_id UUID;
BEGIN
  -- Vytvorenie novej konverzácie
  INSERT INTO chat_conversations (type, name, created_by)
  VALUES ('group', p_name, p_user_id)
  RETURNING id INTO v_conversation_id;

  -- Pridanie vytvárajúceho používateľa ako admina
  INSERT INTO chat_participants (conversation_id, user_id, role)
  VALUES (v_conversation_id, p_user_id, 'admin');

  -- Pridanie ostatných účastníkov
  FOREACH v_participant_id IN ARRAY p_participant_ids
  LOOP
    IF v_participant_id != p_user_id THEN
      INSERT INTO chat_participants (conversation_id, user_id, role)
      VALUES (v_conversation_id, v_participant_id, 'member');
    END IF;
  END LOOP;

  RETURN v_conversation_id;
END;
$$;

-- Pridanie oprávnení pre funkcie
GRANT EXECUTE ON FUNCTION create_direct_conversation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_group_conversation(UUID, TEXT, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_direct_conversation(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_group_conversation(UUID, TEXT, UUID[]) TO service_role;

-- Trigger na aktualizáciu updated_at v konverzáciách
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations
  SET updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_timestamp
  AFTER INSERT OR UPDATE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp(); 