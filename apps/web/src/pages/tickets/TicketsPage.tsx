import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTickets } from '@/api/tickets';
import { TicketStatus, TicketPriority } from '@itdesk/shared';

const priorityVariant: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'success' | 'outline'> = {
  open: 'default',
  in_progress: 'info' as 'default',
  pending: 'secondary',
  resolved: 'success',
  closed: 'outline',
};

export function TicketsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', { search, status, priority, page }],
    queryFn: () =>
      getTickets({
        ...(search && { search }),
        ...(status && { status }),
        ...(priority && { priority }),
        page,
        limit: 25,
      }),
  });

  const tickets = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          {meta && (
            <p className="text-sm text-muted-foreground">{meta.total} total</p>
          )}
        </div>
        <Button asChild>
          <Link to="/tickets/new">
            <Plus className="w-4 h-4" />
            New Ticket
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(TicketStatus).map((s) => (
              <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.values(TicketPriority).map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          )}
          {!isLoading && tickets.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">No tickets found.</div>
          )}
          <div className="divide-y">
            {tickets.map(
              (ticket: {
                id: string;
                ticketNumber: string;
                title: string;
                status: string;
                priority: string;
                category: { name: string };
                submittedBy: { displayName: string };
                assignedTo?: { displayName: string };
                createdAt: string;
              }) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xs font-mono text-muted-foreground w-24 flex-shrink-0">
                    {ticket.ticketNumber}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.category?.name} · {ticket.submittedBy?.displayName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={(priorityVariant[ticket.priority] as 'destructive') ?? 'secondary'}>
                      {ticket.priority}
                    </Badge>
                    <Badge variant={(statusVariant[ticket.status] as 'default') ?? 'secondary'}>
                      {ticket.status.replace('_', ' ')}
                    </Badge>
                    {ticket.assignedTo && (
                      <span className="text-xs text-muted-foreground hidden lg:block">
                        → {ticket.assignedTo.displayName}
                      </span>
                    )}
                  </div>
                </Link>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
