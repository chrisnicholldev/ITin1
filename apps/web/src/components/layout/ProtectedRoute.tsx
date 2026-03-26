import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { getMe } from '@/api/auth';
import { AppShell } from './AppShell';

export function ProtectedRoute() {
  const { isAuthenticated, setTokens, setUser, logout } = useAuthStore();
  const [checking, setChecking] = useState(!isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) return;

    // Attempt a silent refresh using the HttpOnly cookie
    axios
      .post('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then(async ({ data }) => {
        setTokens(data.accessToken);
        const user = await getMe();
        setUser(user);
      })
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
