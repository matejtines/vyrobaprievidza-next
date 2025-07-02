-- Pridanie stĺpca weekend_day do tabuľky zadelenie_kvalita
ALTER TABLE zadelenie_kvalita 
ADD COLUMN IF NOT EXISTS weekend_day VARCHAR(10) CHECK (weekend_day IN ('sobota', 'nedela', NULL));

-- Pridanie komentára k stĺpcu
COMMENT ON COLUMN zadelenie_kvalita.weekend_day IS 'Deň víkendu (sobota/nedeľa) pre zamestnancov v stĺpci Víkend'; 