import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as microsoftTeams from '@microsoft/teams-js';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { getMe } from '@/api/users';

type TeamsAuthState = 'initialising' | 'authenticating' | 'authenticated' | 'error';

const TeamsAuthContext = createContext<{ state: TeamsAuthState; error: string | null; retry: () => void }>({
  state: 'initialising',
  error: null,
  retry: () => {},
});

export function useTeamsAuth() {
  return useContext(TeamsAuthContext);
}

export function TeamsAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TeamsAuthState>('initialising');
  const [error, setError] = useState<string | null>(null);
  const { setTokens, setUser } = useAuthStore();

  async function authenticate() {
    setState('authenticating');
    setError(null);
    try {
      await microsoftTeams.app.initialize();

      const token = await microsoftTeams.authentication.getAuthToken();

      const { data } = await apiClient.post<{ accessToken: string }>('/auth/teams-sso', { token });
      setTokens(data.accessToken);

      const user = await getMe();
      setUser(user);

      setState('authenticated');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Teams SSO failed';
      setError(msg);
      setState('error');
    }
  }

  useEffect(() => { authenticate(); }, []);

  return (
    <TeamsAuthContext.Provider value={{ state, error, retry: authenticate }}>
      {children}
    </TeamsAuthContext.Provider>
  );
}
