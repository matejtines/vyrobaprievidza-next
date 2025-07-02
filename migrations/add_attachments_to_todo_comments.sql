-- Pridanie stĺpca attachment_url do tabuľky todo_comments
ALTER TABLE todo_comments 
ADD COLUMN attachment_url TEXT;

-- Aktualizácia view todo_comments_with_profiles
DROP VIEW IF EXISTS todo_comments_with_profiles;
CREATE VIEW todo_comments_with_profiles AS
SELECT 
    tc.id,
    tc.topic_id,
    tc.user_id,
    tc.content,
    tc.created_at,
    tc.attachment_url,
    p.name,
    p.login
FROM todo_comments tc
LEFT JOIN profiles p ON tc.user_id = p.id
ORDER BY tc.created_at ASC; 