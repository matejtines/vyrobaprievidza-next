-- Najprv odstránime existujúce politiky
DROP POLICY IF EXISTS "enable_all_for_all" ON vykony;
DROP POLICY IF EXISTS "Povoliť čítanie výkonov pre autentizovaných používateľov" ON vykony;
DROP POLICY IF EXISTS "Povoliť vkladanie výkonov pre autentizovaných používateľov" ON vykony;
DROP POLICY IF EXISTS "Povoliť úpravu výkonov pre autentizovaných používateľov" ON vykony;
DROP POLICY IF EXISTS "Povoliť mazanie výkonov pre autentizovaných používateľov" ON vykony;

-- Vypneme RLS dočasne
ALTER TABLE vykony DISABLE ROW LEVEL SECURITY;

-- Povolíme prístup pre všetkých používateľov
GRANT ALL ON vykony TO authenticated;
GRANT ALL ON vykony TO anon;
GRANT ALL ON vykony TO service_role;

-- Vytvoríme nové politiky
CREATE POLICY "enable_all_for_all" ON vykony
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- Zapneme RLS späť
ALTER TABLE vykony ENABLE ROW LEVEL SECURITY;

-- Pridáme RLS pravidlá pre tabuľku normy
DROP POLICY IF EXISTS "enable_all_for_all" ON normy;
ALTER TABLE normy DISABLE ROW LEVEL SECURITY;
GRANT ALL ON normy TO authenticated;
GRANT ALL ON normy TO anon;
GRANT ALL ON normy TO service_role;
CREATE POLICY "enable_all_for_all" ON normy
FOR ALL
TO public
USING (true)
WITH CHECK (true);
ALTER TABLE normy ENABLE ROW LEVEL SECURITY; 