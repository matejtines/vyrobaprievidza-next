-- Add hodinova_norma column to normy_zakazky table
ALTER TABLE normy_zakazky ADD COLUMN hodinova_norma DECIMAL NOT NULL DEFAULT 0;

-- Update existing relationships with the original norma's hodinova_norma
UPDATE normy_zakazky nz
SET hodinova_norma = n.hodinova_norma
FROM normy n
WHERE nz.norma_id = n.id;

-- Remove hodinova_norma from normy table since it will be per zakazka now
ALTER TABLE normy DROP COLUMN hodinova_norma; 