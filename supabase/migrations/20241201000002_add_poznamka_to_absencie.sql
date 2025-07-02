-- Pridanie stĺpca poznamka do tabuľky absencie
ALTER TABLE absencie ADD COLUMN IF NOT EXISTS poznamka TEXT;

-- Vytvorenie indexu pre rýchlejšie vyhľadávanie v poznámkach
CREATE INDEX IF NOT EXISTS idx_absencie_poznamka ON absencie(poznamka) WHERE poznamka IS NOT NULL;

-- Aktualizácia existujúcich záznamov (voliteľné)
-- UPDATE absencie SET poznamka = NULL WHERE poznamka IS NULL; 