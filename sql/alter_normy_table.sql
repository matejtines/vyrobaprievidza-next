-- Pridanie stĺpca skratka do tabuľky normy
ALTER TABLE normy ADD COLUMN IF NOT EXISTS skratka VARCHAR(10);

-- Aktualizácia existujúcich záznamov (ak je potrebné)
UPDATE normy SET skratka = UPPER(LEFT(nazov, 10)) WHERE skratka IS NULL;

-- Nastavenie NOT NULL constraint po aktualizácii
ALTER TABLE normy ALTER COLUMN skratka SET NOT NULL;

-- Vytvorenie indexu pre rýchlejšie vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_normy_skratka ON normy(skratka); 