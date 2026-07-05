import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

type AuthState = {
  session: Session | null;
  /** AsyncStorage'dan ilk oturum okuması bitene kadar true */
  initializing: boolean;
  /** null = oturum var ama henüz profil çekilmedi (yönlendirme kararı bekliyor) */
  onboardingCompleted: boolean | null;
  /** onboarding ekranı kaydettikten/atladıktan sonra çağrılır, gate'i günceller */
  refreshOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  initializing: true,
  onboardingCompleted: null,
  refreshOnboarding: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  const refreshOnboarding = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('onboarding_completed').single();
    // Sorgu başarısız olursa kullanıcıyı sonsuza dek onboarding'e kilitlememek için akışa izin ver.
    setOnboardingCompleted(error ? true : (data?.onboarding_completed ?? true));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      refreshOnboarding();
    } else {
      setOnboardingCompleted(null);
    }
  }, [session, refreshOnboarding]);

  return (
    <AuthContext.Provider value={{ session, initializing, onboardingCompleted, refreshOnboarding }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
