import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { getMe } from '@/api/auth';

/**
 * Landing page after Microsoft OAuth redirect.
 * The API sets the refresh cookie and redirects here with the access token
 * in the URL fragment: /auth/callback#token=<accessToken>
 *
 * We read the token from the hash (never sent to any server), store it in
 * Zustand memory, clear the hash, then redirect to the dashboard.
 * If there's no token but there's an ?error= param, we show it on the login page.
 */
export function AzureCallbackPage() {
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const hash = window.location.hash.slice(1); // strip leading #
    const params = new URLSearchParams(hash);
    const token = params.get('token');

    // Clear fragment from URL immediately so the token isn't visible
    window.history.replaceState(null, '', window.location.pathname);

    if (!token) {
      const searchParams = new URLSearchParams(window.location.search);
      const error = searchParams.get('error') ?? 'Azure login failed';
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    (async () => {
      try {
        setTokens(token);
        const user = await getMe();
        setUser(user);
        navigate('/dashboard', { replace: true });
      } catch {
        navigate('/login?error=Failed+to+load+user+profile', { replace: true });
      }
    })();
  }, [navigate, setTokens, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Signing you in…</span>
      </div>
    </div>
  );
}
