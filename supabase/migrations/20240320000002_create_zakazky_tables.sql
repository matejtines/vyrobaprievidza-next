-- Create zakazky table
CREATE TABLE zakazky (
    id SERIAL PRIMARY KEY,
    cislo_zakazky TEXT NOT NULL UNIQUE,
    nazov TEXT NOT NULL,
    popis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create normy_zakazky junction table
CREATE TABLE normy_zakazky (
    norma_id INTEGER REFERENCES normy(id) ON DELETE CASCADE,
    zakazka_id INTEGER REFERENCES zakazky(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (norma_id, zakazka_id)
);

-- Add indexes for better performance
CREATE INDEX idx_normy_zakazky_norma_id ON normy_zakazky(norma_id);
CREATE INDEX idx_normy_zakazky_zakazka_id ON normy_zakazky(zakazka_id);
CREATE INDEX idx_zakazky_cislo_zakazky ON zakazky(cislo_zakazky);

-- Migrate existing data
INSERT INTO zakazky (cislo_zakazky, nazov)
SELECT DISTINCT zakazka, zakazka
FROM normy
WHERE zakazka IS NOT NULL AND zakazka != '';

-- Create relationships
INSERT INTO normy_zakazky (norma_id, zakazka_id)
SELECT n.id, z.id
FROM normy n
JOIN zakazky z ON n.zakazka = z.cislo_zakazky
WHERE n.zakazka IS NOT NULL AND n.zakazka != '';

-- Remove zakazka column from normy table
ALTER TABLE normy DROP COLUMN zakazka; 