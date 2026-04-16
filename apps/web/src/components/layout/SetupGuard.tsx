import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { getSetupStatus } from '@/api/setup';

/**
 * Wraps any route that should only be accessible once setup is complete.
 * If setup has not been completed, redirects to /setup.
 */
export function SetupGuard({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: getSetupStatus,
    staleTime: Infinity,   // setup state only changes once — never refetch
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  if (!data?.complete) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
