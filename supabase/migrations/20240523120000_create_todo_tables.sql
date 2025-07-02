-- Create custom enum types for status and flags
CREATE TYPE public.todo_status AS ENUM (
    'Nové',
    'V riešení',
    'Vyriešené',
    'Vyžaduje čas',
    'Nevyriešiteľné'
);

CREATE TYPE public.todo_flag AS ENUM (
    'Nebezpečný',
    'Vysoko nebezpečný',
    'Urgentný'
);

-- Table for main ToDo topics
CREATE TABLE public.todo_topics (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT todo_topics_pkey PRIMARY KEY (id),
    CONSTRAINT todo_topics_name_check CHECK (char_length(name) > 0)
);

-- Table for ToDo items (tasks)
CREATE TABLE public.todo_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    topic_id uuid NOT NULL REFERENCES public.todo_topics(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NULL,
    due_date timestamptz NULL,
    status public.todo_status NOT NULL DEFAULT 'Nové'::public.todo_status,
    flags public.todo_flag[] NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT todo_items_pkey PRIMARY KEY (id),
    CONSTRAINT todo_items_title_check CHECK (char_length(title) > 0)
);

-- Table for comments on ToDo items
CREATE TABLE public.todo_comments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.todo_items(id) ON DELETE CASCADE,
    comment_text text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT todo_comments_pkey PRIMARY KEY (id),
    CONSTRAINT todo_comments_text_check CHECK (char_length(comment_text) > 0)
);

-- Table for attachments on ToDo items
CREATE TABLE public.todo_attachments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    item_id uuid NOT NULL REFERENCES public.todo_items(id) ON DELETE CASCADE,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_type text NULL,
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    uploaded_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT todo_attachments_pkey PRIMARY KEY (id)
);

-- Trigger to update 'updated_at' timestamp on todo_items
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_todo_items_update
    BEFORE UPDATE ON public.todo_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies
-- Enable RLS for all new tables
ALTER TABLE public.todo_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.todo_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for todo_topics
CREATE POLICY "Allow authenticated users to view topics" ON public.todo_topics
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert topics" ON public.todo_topics
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow creator to update their topics" ON public.todo_topics
    FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Allow creator to delete their topics" ON public.todo_topics
    FOR DELETE USING (auth.uid() = created_by);

-- Policies for todo_items
CREATE POLICY "Allow authenticated users to view items" ON public.todo_items
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert items" ON public.todo_items
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow creator to update their items" ON public.todo_items
    FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Allow creator to delete their items" ON public.todo_items
    FOR DELETE USING (auth.uid() = created_by);

-- Policies for todo_comments
CREATE POLICY "Allow authenticated users to view comments" ON public.todo_comments
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert comments" ON public.todo_comments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow creator to update their comments" ON public.todo_comments
    FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Allow creator to delete their comments" ON public.todo_comments
    FOR DELETE USING (auth.uid() = created_by);

-- Policies for todo_attachments
CREATE POLICY "Allow authenticated users to view attachments" ON public.todo_attachments
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert attachments" ON public.todo_attachments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow creator to delete their attachments" ON public.todo_attachments
    FOR DELETE USING (auth.uid() = uploaded_by); 