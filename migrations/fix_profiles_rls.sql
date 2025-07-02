-- Najprv odstránime existujúce politiky
DROP POLICY IF EXISTS "enable_all_for_all" ON profiles;
DROP POLICY IF EXISTS "Povoliť čítanie profilov pre autentizovaných používateľov" ON profiles;
DROP POLICY IF EXISTS "Povoliť vkladanie profilov pre autentizovaných používateľov" ON profiles;
DROP POLICY IF EXISTS "Povoliť úpravu profilov pre autentizovaných používateľov" ON profiles;
DROP POLICY IF EXISTS "Povoliť mazanie profilov pre autentizovaných používateľov" ON profiles;
DROP POLICY IF EXISTS "enable_insert_for_auth" ON profiles;

-- Vypneme RLS dočasne
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Povolíme prístup pre všetkých používateľov
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON profiles TO anon;
GRANT ALL ON profiles TO service_role;

-- Vytvoríme nové politiky
CREATE POLICY "enable_read_for_all" ON profiles
FOR SELECT
TO public
USING (true);

CREATE POLICY "enable_insert_for_auth" ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "enable_update_for_own_profile" ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Zapneme RLS späť
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Pridáme chýbajúce stĺpce ak neexistujú
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS login TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Nastavíme NOT NULL constraint pre povinné stĺpce
ALTER TABLE profiles ALTER COLUMN email SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN name SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN login SET NOT NULL;
ALTER TABLE profiles ALTER COLUMN role SET NOT NULL; 