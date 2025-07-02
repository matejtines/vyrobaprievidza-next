-- Add hodinova_norma column to normy table
ALTER TABLE normy ADD COLUMN IF NOT EXISTS hodinova_norma DECIMAL(10,2);
 
-- Update existing records to set hodinova_norma to 0 if it's null
UPDATE normy SET hodinova_norma = 0 WHERE hodinova_norma IS NULL; 