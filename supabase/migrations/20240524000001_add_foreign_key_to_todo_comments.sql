-- Add foreign key constraint between todo_comments and profiles
ALTER TABLE public.todo_comments 
ADD CONSTRAINT todo_comments_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL; 