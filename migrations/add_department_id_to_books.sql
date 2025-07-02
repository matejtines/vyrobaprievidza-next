-- Add department_id column to books table
ALTER TABLE books ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_books_department_id ON books(department_id); 