-- Pridanie stĺpca name do tabuľky profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT;

-- Aktualizácia existujúcich záznamov - nastavíme name na prvé písmeno priezviska (login)
UPDATE profiles 
SET name = SUBSTRING(login, 1, 1)
WHERE name IS NULL;

-- Nastavenie NOT NULL constraint po aktualizácii existujúcich záznamov
ALTER TABLE profiles ALTER COLUMN name SET NOT NULL;

-- Pridanie indexu pre rýchlejšie vyhľadávanie
CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name); 