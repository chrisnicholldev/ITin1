import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getTickets } from '@/api/tickets';
import { TicketStatus } from '@itdesk/shared';

const statusVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  open: 'default',
  in_progress: 'default',
  pending: 'secondary',
  resolved: 'secondary',
  closed: 'outline',
};

const priorityColour: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-yellow-600',
  low: 'text-muted-foreground',
};

export function TeamsTicketsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['teams-tickets'],
    queryFn: () => getTickets({ limit: 50 }),
    refetchOnWindowFocus: true,
  });

  const tickets = (data as any)?.data ?? [];
  const open = tickets.filter((t: any) => t.status === TicketStatus.OPEN || t.status === TicketStatus.IN_PROGRESS || t.status === TicketStatus.PENDING);
  const closed = tickets.filter((t: any) => t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
        <p className="font-medium">No tickets yet</p>
        <p className="text-sm text-muted-foreground">Use the New Ticket tab to submit a request.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {open.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Active</h2>
          <div className="divide-y rounded-lg border bg-card overflow-hidden">
            {open.map((t: any) => <TicketRow key={t.id} ticket={t} />)}
          </div>
        </section>
      )}
      {closed.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Closed</h2>
          <div className="divide-y rounded-lg border bg-card overflow-hidden">
            {closed.map((t: any) => <TicketRow key={t.id} ticket={t} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function TicketRow({ ticket }: { ticket: any }) {
  return (
    <Link
      to={`/teams/tickets/${ticket.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{ticket.title}</p>
        <p className={`text-xs mt-0.5 ${priorityColour[ticket.priority] ?? 'text-muted-foreground'}`}>
          {ticket.ticketNumber} · {ticket.priority}
        </p>
      </div>
      <Badge variant={(statusVariant[ticket.status] ?? 'secondary') as any} className="shrink-0 text-xs">
        {ticket.status.replace('_', ' ')}
      </Badge>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  );
}
