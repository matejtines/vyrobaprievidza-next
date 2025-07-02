-- Add zakazka column to normy table
ALTER TABLE normy ADD COLUMN zakazka TEXT NOT NULL DEFAULT '';
 
-- Update existing rows to have a default value
UPDATE normy SET zakazka = '' WHERE zakazka IS NULL; 