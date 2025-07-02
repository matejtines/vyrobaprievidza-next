-- Povolenie SELECT pre všetkých autentizovaných používateľov
CREATE POLICY "Povoliť čítanie výkonov pre autentizovaných používateľov"
ON vykony
FOR SELECT
TO authenticated
USING (true);

-- Povolenie INSERT pre všetkých autentizovaných používateľov
CREATE POLICY "Povoliť vkladanie výkonov pre autentizovaných používateľov"
ON vykony
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Povolenie UPDATE pre všetkých autentizovaných používateľov
CREATE POLICY "Povoliť úpravu výkonov pre autentizovaných používateľov"
ON vykony
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Povolenie DELETE pre všetkých autentizovaných používateľov
CREATE POLICY "Povoliť mazanie výkonov pre autentizovaných používateľov"
ON vykony
FOR DELETE
TO authenticated
USING (true);

-- Povolenie RLS na tabuľke
ALTER TABLE vykony ENABLE ROW LEVEL SECURITY; 