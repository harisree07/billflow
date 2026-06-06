import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(authUser) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role')
        .eq('id', authUser.id)
        .single();

      if (!error && data) {
        // Merge Supabase Auth user metadata with DB profile
        setUser({ ...authUser, ...data });
      } else {
        console.error('Error fetching profile:', error);
        setUser(null);
      }
    } catch (err) {
      console.error(err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      throw new Error(error.message);
    }
  };

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ user, login, logout, loading }}>
      {children}
    </Ctx.Provider>
  );
}
