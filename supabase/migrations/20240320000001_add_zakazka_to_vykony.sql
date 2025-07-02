-- Add zakazka column to vykony table
ALTER TABLE vykony ADD COLUMN zakazka TEXT;
 
-- Update existing rows to have a default value
UPDATE vykony SET zakazka = '' WHERE zakazka IS NULL; 