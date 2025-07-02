-- Pridanie stĺpca weekend_day do tabuľky zadelenie_mechanikov
ALTER TABLE zadelenie_mechanikov
ADD COLUMN weekend_day VARCHAR(10) CHECK (weekend_day IN ('sobota', 'nedela'));

-- Aktualizácia CHECK constraintu pre stĺpec zmena
ALTER TABLE zadelenie_mechanikov
DROP CONSTRAINT IF EXISTS zadelenie_mechanikov_zmena_check;

ALTER TABLE zadelenie_mechanikov
ADD CONSTRAINT zadelenie_mechanikov_zmena_check 
CHECK (zmena IN ('Ranná', 'Poobedná', 'Víkend'));

-- Aktualizácia existujúcich záznamov z 'Hotovosť' na 'Víkend'
UPDATE zadelenie_mechanikov
SET zmena = 'Víkend'
WHERE zmena = 'Hotovosť';

-- Pridanie komentára k stĺpcu
COMMENT ON COLUMN zadelenie_mechanikov.weekend_day IS 'Špecifikuje, či ide o sobotu alebo nedeľu pre víkendové zmeny';

-- Pridanie indexu pre rýchlejšie vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_zadelenie_mechanikov_weekend_day 
ON zadelenie_mechanikov(weekend_day);

-- Pridanie triggeru pre automatickú aktualizáciu updated_at
CREATE OR REPLACE FUNCTION update_zadelenie_mechanikov_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_zadelenie_mechanikov_updated_at ON zadelenie_mechanikov;

CREATE TRIGGER set_zadelenie_mechanikov_updated_at
    BEFORE UPDATE ON zadelenie_mechanikov
    FOR EACH ROW
    EXECUTE FUNCTION update_zadelenie_mechanikov_updated_at(); 