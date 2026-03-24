import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { getMe } from '@/api/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const { setTokens, setUser, logout } = useAuthStore();

  useEffect(() => {
    async function init() {
      try {
        // Try to get a new access token using the refresh cookie
        const { data } = await axios.post(
          '/api/v1/auth/refresh',
          {},
          { withCredentials: true },
        );
        setTokens(data.accessToken);
        const user = await getMe();
        setUser(user);
      } catch {
        // No valid session — stay logged out, redirect handled by ProtectedRoute
        logout();
      } finally {
        setReady(true);
      }
    }

    init();
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
