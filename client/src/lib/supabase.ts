import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key-here';

// Len varovanie namiesto chyby
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Chýbajúce Supabase konfiguračné premenné - používam fallback hodnoty');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase; 