-- Pridanie stĺpca zakazka_id do tabuľky vykony
ALTER TABLE vykony
ADD COLUMN zakazka_id INTEGER REFERENCES zakazky(id);

-- Pridanie indexu pre rýchlejšie vyhľadávanie
CREATE INDEX idx_vykony_zakazka_id ON vykony(zakazka_id);

-- Pridanie komentára k stĺpcu
COMMENT ON COLUMN vykony.zakazka_id IS 'ID zákazky pre výkon, ak norma má priradené zákazky'; 