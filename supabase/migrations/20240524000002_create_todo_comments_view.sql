-- Drop existing view if it exists
DROP VIEW IF EXISTS public.todo_comments_with_profiles;

-- Create a view that joins todo_comments with profiles to get user names
CREATE OR REPLACE VIEW public.todo_comments_with_profiles AS
SELECT 
    tc.id,
    tc.item_id,
    tc.comment_text,
    tc.created_at,
    tc.created_by,
    p.login,
    p.name
FROM public.todo_comments tc
LEFT JOIN public.profiles p ON tc.created_by = p.id;

-- Grant permissions to authenticated users
GRANT SELECT ON public.todo_comments_with_profiles TO authenticated; 