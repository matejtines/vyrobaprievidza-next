-- Vytvorenie tabuľky vykony
CREATE TABLE IF NOT EXISTS vykony (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    employee_id BIGINT NOT NULL,
    employee_type TEXT NOT NULL CHECK (employee_type IN ('zamestnanci', 'vzzorman')),
    norma_id BIGINT NOT NULL REFERENCES normy(id),
    datum DATE NOT NULL,
    pocet_ks INTEGER NOT NULL,
    pocet_hodin DECIMAL(4,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(employee_id, employee_type, norma_id, datum)
);

-- Vytvorenie indexov pre rýchlejšie vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_vykony_employee ON vykony(employee_id, employee_type);
CREATE INDEX IF NOT EXISTS idx_vykony_datum ON vykony(datum);
CREATE INDEX IF NOT EXISTS idx_vykony_norma ON vykony(norma_id);

-- Vytvorenie triggeru pre automatické aktualizovanie updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vykony_updated_at
    BEFORE UPDATE ON vykony
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Vytvorenie RLS (Row Level Security) politiky
ALTER TABLE vykony ENABLE ROW LEVEL SECURITY;

-- Vytvorenie politiky pre čítanie (SELECT)
CREATE POLICY "Povoliť čítanie výkonov všetkým používateľom"
    ON vykony FOR SELECT
    USING (true);

-- Vytvorenie politiky pre vkladanie (INSERT)
CREATE POLICY "Povoliť vkladanie výkonov autentizovaným používateľom"
    ON vykony FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Vytvorenie politiky pre aktualizáciu (UPDATE)
CREATE POLICY "Povoliť aktualizáciu výkonov autentizovaným používateľom"
    ON vykony FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Vytvorenie politiky pre mazanie (DELETE)
CREATE POLICY "Povoliť mazanie výkonov autentizovaným používateľom"
    ON vykony FOR DELETE
    USING (auth.role() = 'authenticated'); 