-- Najprv odstránime existujúci CHECK constraint
ALTER TABLE zadelenie_kvalita DROP CONSTRAINT IF EXISTS zadelenie_kvalita_zmena_check;

-- Pridáme nový CHECK constraint s aktualizovanými hodnotami
ALTER TABLE zadelenie_kvalita ADD CONSTRAINT zadelenie_kvalita_zmena_check 
    CHECK (zmena IN ('Ranná', 'Poobedná', 'Víkend'));

-- Aktualizujeme existujúce záznamy
UPDATE zadelenie_kvalita SET zmena = 'Víkend' WHERE zmena = 'Hotovosť';

-- Aktualizujeme komentár k stĺpcu
COMMENT ON COLUMN zadelenie_kvalita.zmena IS 'Typ zmeny (Ranná, Poobedná, Víkend)'; 