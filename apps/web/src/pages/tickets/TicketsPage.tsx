import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Bookmark, X, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTickets, bulkUpdateTickets } from '@/api/tickets';
import { getTeams } from '@/api/teams';
import { TicketStatus, TicketPriority, UserRole } from '@itdesk/shared';
import { useAuthStore } from '@/stores/auth.store';

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

type SavedView = { name: string; search: string; status: string; priority: string; assignedTeam: string };
const STORAGE_KEY = 'ticket-saved-views';
function loadViews(): SavedView[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

export function TicketsPage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isTech = user?.role !== UserRole.END_USER;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [assignedTeam, setAssignedTeam] = useState('');
  const [page, setPage] = useState(1);

  const [savedViews, setSavedViews] = useState<SavedView[]>(loadViews);
  const [savingName, setSavingName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');

  function saveView() {
    if (!savingName.trim()) return;
    const view: SavedView = { name: savingName.trim(), search, status, priority, assignedTeam };
    const updated = [...savedViews.filter((v) => v.name !== view.name), view];
    setSavedViews(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSavingName('');
    setShowSaveInput(false);
  }

  function loadView(name: string) {
    const view = savedViews.find((v) => v.name === name);
    if (!view) return;
    setSearch(view.search); setStatus(view.status); setPriority(view.priority);
    setAssignedTeam(view.assignedTeam); setPage(1);
  }

  function deleteView(name: string) {
    const updated = savedViews.filter((v) => v.name !== name);
    setSavedViews(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  function toggleAll(ids: string[]) {
    if (ids.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ids));
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const bulkMutation = useMutation({
    mutationFn: () =>
      bulkUpdateTickets(Array.from(selected), {
        ...(bulkStatus && { status: bulkStatus }),
        ...(bulkPriority && { priority: bulkPriority }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      setSelected(new Set());
      setBulkStatus('');
      setBulkPriority('');
    },
  });

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
    enabled: isTech,
  });
  const teams: Array<{ id: string; name: string }> = teamsData ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', { search, status, priority, assignedTeam, page }],
    queryFn: () =>
      getTickets({
        ...(search && { search }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(assignedTeam && { assignedTeam }),
        page,
        limit: 25,
      }),
  });

  const tickets = data?.data ?? [];
  const meta = data?.meta;
  const ticketIds: string[] = tickets.map((t: { id: string }) => t.id);
  const allSelected = ticketIds.length > 0 && ticketIds.every((id: string) => selected.has(id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          {meta && <p className="text-sm text-muted-foreground">{meta.total} total</p>}
        </div>
        <div className="flex gap-2">
          {isTech && (
            <Button variant="outline" asChild>
              <Link to="/tickets/reports"><BarChart2 className="w-4 h-4 mr-1" />Reports</Link>
            </Button>
          )}
          <Button asChild>
            <Link to="/tickets/new"><Plus className="w-4 h-4" />New Ticket</Link>
          </Button>
        </div>
      </div>

      {/* Saved views */}
      <div className="flex flex-wrap items-center gap-2">
        {savedViews.length > 0 && (
          <Select onValueChange={loadView}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="Load saved view..." />
            </SelectTrigger>
            <SelectContent>
              {savedViews.map((v) => (
                <div key={v.name} className="flex items-center justify-between pr-1">
                  <SelectItem value={v.name} className="flex-1">{v.name}</SelectItem>
                  <button
                    className="ml-1 text-muted-foreground hover:text-destructive p-1"
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); deleteView(v.name); }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </SelectContent>
          </Select>
        )}
        {showSaveInput ? (
          <div className="flex items-center gap-1">
            <Input
              className="h-8 text-xs w-40"
              placeholder="View name..."
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveView(); if (e.key === 'Escape') setShowSaveInput(false); }}
              autoFocus
            />
            <Button size="sm" className="h-8 text-xs" onClick={saveView}>Save</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowSaveInput(false)}><X className="w-3 h-3" /></Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => setShowSaveInput(true)}>
            <Bookmark className="w-3 h-3" /> Save view
          </Button>
        )}
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
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(TicketStatus).map((s) => (
              <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(v) => { setPriority(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.values(TicketPriority).map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isTech && (
          <Select value={assignedTeam || 'all'} onValueChange={(v) => { setAssignedTeam(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Bulk toolbar */}
      {isTech && selected.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-muted rounded-md border flex-wrap">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select value={bulkStatus} onValueChange={setBulkStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Set status..." /></SelectTrigger>
            <SelectContent>
              {Object.values(TicketStatus).map((s) => (
                <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bulkPriority} onValueChange={setBulkPriority}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Set priority..." /></SelectTrigger>
            <SelectContent>
              {Object.values(TicketPriority).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={(!bulkStatus && !bulkPriority) || bulkMutation.isPending}
            onClick={() => bulkMutation.mutate()}
          >
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>
          )}
          {!isLoading && tickets.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">No tickets found.</div>
          )}
          {isTech && tickets.length > 0 && (
            <div className="px-4 py-2 border-b flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => toggleAll(ticketIds)}
                className="w-4 h-4"
              />
              <span className="text-xs text-muted-foreground">Select all on page</span>
            </div>
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
                <div key={ticket.id} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                  {isTech && (
                    <input
                      type="checkbox"
                      checked={selected.has(ticket.id)}
                      onChange={() => toggleOne(ticket.id)}
                      className="w-4 h-4 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                  <Link
                    to={`/tickets/${ticket.id}`}
                    className="flex items-center gap-4 flex-1 min-w-0"
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
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {meta.page} of {meta.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
