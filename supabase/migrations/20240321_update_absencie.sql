-- Najprv odstránime existujúci cudzí kľúč
ALTER TABLE absencie DROP CONSTRAINT IF EXISTS absencie_employee_id_fkey;

-- Pridáme nový stĺpec pre typ zamestnanca
ALTER TABLE absencie ADD COLUMN employee_type TEXT NOT NULL DEFAULT 'zamestnanci' CHECK (employee_type IN ('zamestnanci', 'vzzorman'));

-- Vytvoríme funkciu pre kontrolu existencie zamestnanca
CREATE OR REPLACE FUNCTION check_employee_exists()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.employee_type = 'zamestnanci' THEN
        IF NOT EXISTS (SELECT 1 FROM zamestnanci WHERE id = NEW.employee_id) THEN
            RAISE EXCEPTION 'Zamestnanec s ID % neexistuje v tabuľke zamestnanci', NEW.employee_id;
        END IF;
    ELSIF NEW.employee_type = 'vzzorman' THEN
        IF NOT EXISTS (SELECT 1 FROM vzzorman WHERE id = NEW.employee_id) THEN
            RAISE EXCEPTION 'Zamestnanec s ID % neexistuje v tabuľke vzzorman', NEW.employee_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Vytvoríme trigger, ktorý bude kontrolovať existenciu zamestnanca
DROP TRIGGER IF EXISTS check_employee_exists_trigger ON absencie;
CREATE TRIGGER check_employee_exists_trigger
    BEFORE INSERT OR UPDATE ON absencie
    FOR EACH ROW
    EXECUTE FUNCTION check_employee_exists();

-- Vytvoríme index pre rýchlejšie vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_absencie_employee ON absencie(employee_id, employee_type); 