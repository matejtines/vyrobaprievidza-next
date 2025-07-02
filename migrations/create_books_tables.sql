-- Create departments table
CREATE TABLE IF NOT EXISTS departments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create books table
CREATE TABLE IF NOT EXISTS books (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable Row Level Security
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies for departments
CREATE POLICY "Users can view all departments" ON departments
    FOR SELECT USING (true);

CREATE POLICY "Users can create departments" ON departments
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own departments" ON departments
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own departments" ON departments
    FOR DELETE USING (auth.uid() = created_by);

-- Create policies for books
CREATE POLICY "Users can view all books" ON books
    FOR SELECT USING (true);

CREATE POLICY "Users can create books" ON books
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own books" ON books
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own books" ON books
    FOR DELETE USING (auth.uid() = created_by);

-- Create policies for notes
CREATE POLICY "Users can view all notes" ON notes
    FOR SELECT USING (true);

CREATE POLICY "Users can create notes" ON notes
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own notes" ON notes
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own notes" ON notes
    FOR DELETE USING (auth.uid() = created_by);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_departments_created_by ON departments(created_by);
CREATE INDEX IF NOT EXISTS idx_books_department_id ON books(department_id);
CREATE INDEX IF NOT EXISTS idx_books_created_by ON books(created_by);
CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_by ON notes(created_by);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC); 