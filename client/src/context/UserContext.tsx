import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import supabase from '../lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  login: string;
  role: string;
}

interface UserContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => void;
}

const UserContext = createContext<UserContextType>({ user: null, loading: true, error: null, refreshUser: () => {} });

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setUser(null);
        setError('Chyba pri načítaní session. Skúste sa odhlásiť a prihlásiť znova.');
        setLoading(false);
        return;
      }
      if (!session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, login, role, name')
        .eq('id', session.user.id)
        .maybeSingle();
      if (profileError) {
        setUser(null);
        setError('Chyba pri načítaní profilu. Skúste sa odhlásiť a prihlásiť znova.');
      } else if (data) {
        setUser({
          id: data.id,
          email: data.email,
          login: data.login,
          role: data.role,
        });
        setError(null);
      } else {
        setUser(null);
        setError('Profil nebol nájdený.');
      }
    } catch (error) {
      setUser(null);
      setError('Chyba pri načítaní používateľa. Skúste sa odhlásiť a prihlásiť znova.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      } else {
        await fetchUserProfile();
      }
    });
    // Pridaj listener na storage event (zmena session v inej karte/okne)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && event.key.startsWith('sb-')) {
        fetchUserProfile();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, error, refreshUser: fetchUserProfile }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext); 