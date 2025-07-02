-- Vymazanie existujúcich funkcií
DROP FUNCTION IF EXISTS create_direct_conversation(uuid, uuid);
DROP FUNCTION IF EXISTS get_user_conversations(uuid);
DROP FUNCTION IF EXISTS get_conversation_messages(uuid, integer, integer);
DROP FUNCTION IF EXISTS get_conversation_participants(uuid);
DROP FUNCTION IF EXISTS update_conversation_updated_at();

-- Vymazanie existujúcich triggerov
DROP TRIGGER IF EXISTS update_conversation_updated_at_trigger ON chat_messages;

-- Vymazanie existujúcich tabuliek
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS chat_participants;
DROP TABLE IF EXISTS chat_conversations;

-- Vymazanie existujúcich typov
DROP TYPE IF EXISTS conversation_type;
DROP TYPE IF EXISTS participant_role; 