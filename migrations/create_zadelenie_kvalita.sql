-- Vytvorenie tabuľky zadelenie_kvalita
CREATE TABLE IF NOT EXISTS zadelenie_kvalita (
    id SERIAL PRIMARY KEY,
    zamestnanec_id INTEGER NOT NULL REFERENCES zamestnanci(id) ON DELETE CASCADE,
    zmena VARCHAR(20) NOT NULL CHECK (zmena IN ('Ranná', 'Poobedná', 'Hotovosť')),
    tyzden INTEGER NOT NULL CHECK (tyzden BETWEEN 1 AND 53),
    rok INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zamestnanec_id, tyzden, rok)
);

-- Vytvorenie indexu pre rýchlejšie vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_zadelenie_kvalita_zamestnanec ON zadelenie_kvalita(zamestnanec_id);
CREATE INDEX IF NOT EXISTS idx_zadelenie_kvalita_tyzden_rok ON zadelenie_kvalita(tyzden, rok);

-- Trigger pre automatické aktualizovanie updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_zadelenie_kvalita_updated_at
    BEFORE UPDATE ON zadelenie_kvalita
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Komentáre k tabuľke a stĺpcom
COMMENT ON TABLE zadelenie_kvalita IS 'Tabuľka pre zadelenie zamestnancov kvality do zmien';
COMMENT ON COLUMN zadelenie_kvalita.zamestnanec_id IS 'ID zamestnanca z tabuľky zamestnanci';
COMMENT ON COLUMN zadelenie_kvalita.zmena IS 'Typ zmeny (Ranná, Poobedná, Hotovosť)';
COMMENT ON COLUMN zadelenie_kvalita.tyzden IS 'Číslo týždňa v roku (1-53)';
COMMENT ON COLUMN zadelenie_kvalita.rok IS 'Rok zadelenia';
COMMENT ON COLUMN zadelenie_kvalita.created_at IS 'Dátum a čas vytvorenia záznamu';
COMMENT ON COLUMN zadelenie_kvalita.updated_at IS 'Dátum a čas poslednej aktualizácie záznamu'; 