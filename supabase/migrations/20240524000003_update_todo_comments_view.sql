-- Update the view to include comment attachments
DROP VIEW IF EXISTS public.todo_comments_with_profiles;

CREATE OR REPLACE VIEW public.todo_comments_with_profiles AS
SELECT 
    tc.id,
    tc.item_id,
    tc.comment_text,
    tc.created_at,
    tc.created_by,
    tc.attachment_url,
    tc.attachment_name,
    tc.attachment_type,
    p.login,
    p.name
FROM public.todo_comments tc
LEFT JOIN public.profiles p ON tc.created_by = p.id;

-- Grant permissions to authenticated users
GRANT SELECT ON public.todo_comments_with_profiles TO authenticated; 