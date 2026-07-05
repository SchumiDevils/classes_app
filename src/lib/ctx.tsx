import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { ProfilCurent, Rol, TipOrganizatie } from '@/lib/database.types';

type AuthState = {
  session: Session | null;
  profile: ProfilCurent | null;
  isLoading: boolean;
  signIn: (email: string, parola: string) => Promise<void>;
  signUp: (email: string, parola: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  onboard: (input: {
    numeOrganizatie: string;
    tip: TipOrganizatie;
    numePrenume: string;
    specializare?: string;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useSession() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useSession trebuie folosit in interiorul <SessionProvider />');
  }
  return value;
}

async function fetchProfil(): Promise<ProfilCurent | null> {
  const { data, error } = await supabase.rpc('get_profil_curent');
  if (error) {
    console.warn('get_profil_curent:', error.message);
    return null;
  }
  return data && data.length > 0 ? data[0] : null;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfilCurent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    setProfile(await fetchProfil());
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session);
      await loadProfile(data.session);
      if (mounted) setIsLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      loadProfile(s);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, parola: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: parola });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, parola: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password: parola });
    if (error) throw error;
    // Daca confirmarea prin email este activata, nu exista sesiune imediat.
    return { needsConfirm: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    setProfile(await fetchProfil());
  }, []);

  const onboard = useCallback<AuthState['onboard']>(async (input) => {
    const { error } = await supabase.rpc('onboard_organizatie', {
      p_nume_organizatie: input.numeOrganizatie,
      p_tip: input.tip,
      p_nume_prenume: input.numePrenume,
      p_specializare: input.specializare ?? null,
    });
    if (error) throw error;
    await refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<AuthState>(
    () => ({ session, profile, isLoading, signIn, signUp, signOut, refreshProfile, onboard }),
    [session, profile, isLoading, signIn, signUp, signOut, refreshProfile, onboard],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const ROLURI_ADMIN: Rol[] = ['OWNER', 'ADMIN'];
export const ROLURI_STAFF: Rol[] = ['OWNER', 'ADMIN', 'PROFESOR'];
export const ROLURI_TUTORE: Rol[] = ['TUTOR'];

export const esteAdmin = (rol?: Rol | null) => !!rol && ROLURI_ADMIN.includes(rol);
export const esteStaff = (rol?: Rol | null) => !!rol && ROLURI_STAFF.includes(rol);
export const esteTutore = (rol?: Rol | null) => !!rol && ROLURI_TUTORE.includes(rol);
