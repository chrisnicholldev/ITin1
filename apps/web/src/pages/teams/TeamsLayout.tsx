import { Link, useLocation, Outlet } from 'react-router-dom';
import { Ticket, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeamsAuthProvider, useTeamsAuth } from './TeamsAuthProvider';

function TeamsShell() {
  const { state, error, retry } = useTeamsAuth();
  const location = useLocation();

  if (state === 'initialising' || state === 'authenticating') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Signing you in…</p>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="font-semibold">Sign-in failed</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={retry}>Try again</Button>
        </div>
      </div>
    );
  }

  const isNewTicket = location.pathname === '/teams/tickets/new';
  const isTicketsList = location.pathname === '/teams/tickets' || location.pathname === '/teams';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
          <Ticket className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-semibold text-sm">IT Helpdesk</span>
      </header>

      {/* Tab nav */}
      <nav className="border-b bg-card px-4 flex gap-1 shrink-0">
        <Link
          to="/teams/tickets"
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            isTicketsList
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          My Tickets
        </Link>
        <Link
          to="/teams/tickets/new"
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
            isNewTicket
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Plus className="h-3.5 w-3.5" /> New Ticket
        </Link>
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}

export function TeamsLayout() {
  return (
    <TeamsAuthProvider>
      <TeamsShell />
    </TeamsAuthProvider>
  );
}
