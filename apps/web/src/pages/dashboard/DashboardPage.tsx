import { useQuery } from '@tanstack/react-query';
import { Ticket, Monitor, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTickets } from '@/api/tickets';
import { getAssetSummary } from '@/api/assets';
import { useAuthStore } from '@/stores/auth.store';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { UserRole } from '@itdesk/shared';

function StatCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

const priorityVariant: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isTech = user?.role !== UserRole.END_USER;

  const { data: ticketsData } = useQuery({
    queryKey: ['tickets', 'dashboard'],
    queryFn: () => getTickets({ limit: 5, status: 'open' }),
  });

  const { data: assetSummary } = useQuery({
    queryKey: ['assets', 'summary'],
    queryFn: getAssetSummary,
    enabled: isTech,
  });

  const openCount = ticketsData?.meta?.total ?? 0;
  const activeAssets =
    assetSummary?.byStatus?.find((s: { _id: string }) => s._id === 'active')?.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.displayName}</p>
      </div>

      <div className={`grid gap-4 ${isTech ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
        <StatCard title="Open Tickets" value={openCount} icon={Ticket} />
        {isTech && (
          <>
            <StatCard title="Active Assets" value={activeAssets} icon={Monitor} />
            <StatCard title="Critical" value="—" icon={AlertTriangle} description="coming soon" />
            <StatCard title="Resolved Today" value="—" icon={CheckCircle} description="coming soon" />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Open Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {ticketsData?.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">No open tickets.</p>
          )}
          <div className="divide-y">
            {ticketsData?.data?.map(
              (ticket: {
                id: string;
                ticketNumber: string;
                title: string;
                priority: string;
                category: { name: string };
                createdAt: string;
              }) => (
                <Link
                  key={ticket.id}
                  to={`/tickets/${ticket.id}`}
                  className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-20 flex-shrink-0">
                      {ticket.ticketNumber}
                    </span>
                    <span className="text-sm font-medium truncate">{ticket.title}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <Badge variant={priorityVariant[ticket.priority] ?? 'secondary'}>
                      {ticket.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {ticket.category?.name}
                    </span>
                  </div>
                </Link>
              ),
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
