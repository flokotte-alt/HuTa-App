// Anmeldung. Kunden bleiben dauerhaft angemeldet. Vor der App stehen bei Kunden zwei Schritte:
// eigenes Passwort setzen (erster Login) und das Datenschutzdokument annehmen.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { removePushToken } from './push';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  role: 'provider' | 'customer';
  name: string;
  phone: string | null;
  email: string | null;
  must_change_password: boolean;
};

type Account = { profile: Profile; consent: boolean };

type Ctx = {
  session: Session | null;
  profile: Profile | null;
  consent: boolean;
  loading: boolean;
  failed: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({
  session: null,
  profile: null,
  consent: false,
  loading: true,
  failed: false,
  refresh: async () => {},
  signOut: async () => {},
});

const CACHE = 'huta:account';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const loadAccount = useCallback(async (s: Session | null) => {
    if (!s) {
      setAccount(null);
      setFailed(false);
      return;
    }
    const [p, c] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle(),
      supabase.from('consents').select('user_id').eq('user_id', s.user.id).maybeSingle(),
    ]);
    if (p.data && !c.error) {
      const next = { profile: p.data as Profile, consent: !!c.data };
      setAccount(next);
      setFailed(false);
      AsyncStorage.setItem(CACHE, JSON.stringify(next)).catch(() => {});
      return;
    }
    // Ohne Netz mit dem zuletzt bekannten Stand weiterarbeiten
    const raw = await AsyncStorage.getItem(CACHE).catch(() => null);
    const saved = raw ? (JSON.parse(raw) as Account) : null;
    if (saved?.profile.id === s.user.id) setAccount(saved);
    else setFailed(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadAccount(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setTimeout(() => loadAccount(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadAccount]);

  const mine = account && account.profile.id === session?.user.id ? account : null;
  const value: Ctx = {
    session,
    profile: mine?.profile ?? null,
    consent: mine?.consent ?? false,
    loading,
    failed,
    refresh: () => loadAccount(session),
    signOut: async () => {
      await removePushToken();
      await AsyncStorage.removeItem(CACHE).catch(() => {});
      await supabase.auth.signOut();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
