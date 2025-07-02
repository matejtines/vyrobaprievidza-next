-- Create departments table
CREATE TABLE public.departments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    CONSTRAINT departments_pkey PRIMARY KEY (id),
    CONSTRAINT departments_name_check CHECK (char_length(name) > 0)
);

-- Create bookmarks table
CREATE TABLE public.bookmarks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text NULL,
    url text NULL,
    type text NOT NULL CHECK (type IN ('link', 'note')),
    created_at timestamptz NOT NULL DEFAULT now(),
    created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT bookmarks_pkey PRIMARY KEY (id),
    CONSTRAINT bookmarks_title_check CHECK (char_length(title) > 0)
);

-- Trigger to update 'updated_at' timestamp on bookmarks
CREATE OR REPLACE FUNCTION public.handle_bookmarks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_bookmarks_update
    BEFORE UPDATE ON public.bookmarks
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_bookmarks_updated_at();

-- RLS Policies
-- Enable RLS for new tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies for departments
CREATE POLICY "Allow authenticated users to view departments" ON public.departments
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert departments" ON public.departments
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow creator to update their departments" ON public.departments
    FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Allow creator to delete their departments" ON public.departments
    FOR DELETE USING (auth.uid() = created_by);

-- Policies for bookmarks
CREATE POLICY "Allow authenticated users to view bookmarks" ON public.bookmarks
    FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated users to insert bookmarks" ON public.bookmarks
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow creator to update their bookmarks" ON public.bookmarks
    FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Allow creator to delete their bookmarks" ON public.bookmarks
    FOR DELETE USING (auth.uid() = created_by); 