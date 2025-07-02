-- Pridanie stĺpcov pre zaúčanie
ALTER TABLE vykony
ADD COLUMN zaucanie BOOLEAN DEFAULT FALSE,
ADD COLUMN zaucanie_poznamka TEXT;

-- Pridanie stĺpcov pre poruchu/opravu
ALTER TABLE vykony
ADD COLUMN porucha BOOLEAN DEFAULT FALSE,
ADD COLUMN porucha_poznamka TEXT;

-- Pridanie komentárov k stĺpcom
COMMENT ON COLUMN vykony.zaucanie IS 'Indikátor či ide o zaúčanie';
COMMENT ON COLUMN vykony.zaucanie_poznamka IS 'Poznámka k zaúčaniu';
COMMENT ON COLUMN vykony.porucha IS 'Indikátor či ide o poruchu/opravu/iné';
COMMENT ON COLUMN vykony.porucha_poznamka IS 'Poznámka k poruche/oprave';

-- Vytvorenie indexov pre rýchlejšie vyhľadávanie
CREATE INDEX idx_vykony_zaucanie ON vykony(zaucanie);
CREATE INDEX idx_vykony_porucha ON vykony(porucha); 