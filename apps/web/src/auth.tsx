import { createContext, useContext, useMemo, useState } from 'react';
import { api, type AuthSession } from './lib/api';

interface AuthContextValue {
  session: AuthSession | null;
  login: (email: string, password: string) => Promise<void>;
  enterDemo: () => void;
  logout: () => void;
}

const STORAGE_KEY = 'chargeops.session';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as AuthSession) : null;
    } catch {
      return null;
    }
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      async login(email, password) {
        const next = await api.login(email, password);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
      },
      enterDemo() {
        const next: AuthSession = {
          accessToken: 'demo',
          user: {
            id: 'demo',
            name: 'Lucas',
            email: 'demo@chargeops.local',
            role: 'ADMIN',
            unitId: null,
          },
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setSession(next);
      },
      logout() {
        sessionStorage.removeItem(STORAGE_KEY);
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return value;
}
