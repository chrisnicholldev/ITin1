import { useQuery } from '@tanstack/react-query';
import {
  Ticket, Monitor, Globe, Server, BookOpen, Users,
  AlertTriangle, ArrowRight, Cpu, Printer,
  Router, Wifi, HardDrive, Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';
import { getTickets } from '@/api/tickets';
import { getAssets, getAssetSummary } from '@/api/assets';
import { getNetworks } from '@/api/networks';
import { listRacks } from '@/api/racks';
import { getArticles } from '@/api/docs';
import { getUsers } from '@/api/users';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  title, value, icon: Icon, to, colour = 'text-muted-foreground',
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  to: string;
  colour?: string;
}) {
  return (
    <Link to={to}>
      <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <Icon className={`w-4 h-4 ${colour}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value ?? '—'}</div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Quick-link module card ────────────────────────────────────────────────────

function ModuleCard({
  title, description, icon: Icon, to, colour,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  to: string;
  colour: string;
}) {
  return (
    <Link to={to}>
      <Card className="hover:border-primary/40 hover:shadow-sm transition-all h-full cursor-pointer">
        <CardContent className="pt-4 pb-4 flex items-start gap-3">
          <div className={`p-2 rounded-lg ${colour} shrink-0`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Asset type icon map ───────────────────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  workstation: Monitor,
  laptop: Monitor,
  server: Server,
  printer: Printer,
  switch: HardDrive,
  router: Router,
  firewall: AlertTriangle,
  access_point: Wifi,
  phone: Cpu,
  software_license: Package,
  other: Package,
};

const priorityVariant: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isTech = user?.role !== UserRole.END_USER;

  const { data: ticketsData } = useQuery({
    queryKey: ['tickets', 'dashboard'],
    queryFn: () => getTickets({ limit: 6, status: 'open' }),
  });

  const { data: assetSummary } = useQuery({
    queryKey: ['assets', 'summary'],
    queryFn: getAssetSummary,
    enabled: isTech,
  });

  const { data: recentAssets } = useQuery({
    queryKey: ['assets', 'dashboard-recent'],
    queryFn: () => getAssets({ limit: 5, sort: 'createdAt', order: 'desc' }),
    enabled: isTech,
  });

  const { data: networks = [] } = useQuery({
    queryKey: ['networks'],
    queryFn: () => getNetworks(),
    enabled: isTech,
  });

  const { data: racks = [] } = useQuery({
    queryKey: ['racks'],
    queryFn: listRacks,
    enabled: isTech,
  });

  const { data: docsData } = useQuery({
    queryKey: ['articles', 'dashboard'],
    queryFn: () => getArticles({ limit: 1 }),
    enabled: isTech,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'dashboard'],
    queryFn: () => getUsers({ limit: 1 }),
    enabled: isAdmin,
  });

  const openTickets = ticketsData?.meta?.total ?? 0;
  const activeAssets = assetSummary?.byStatus?.find((s: { _id: string }) => s._id === 'active')?.count ?? 0;
  const totalArticles = docsData?.meta?.total ?? 0;
  const totalUsers = usersData?.meta?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {user?.displayName}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Open Tickets" value={openTickets} icon={Ticket} to="/tickets" colour="text-orange-500" />
        {isTech && (
          <>
            <StatCard title="Active Assets" value={activeAssets} icon={Monitor} to="/assets" colour="text-blue-500" />
            <StatCard title="Networks" value={(networks as any[]).length} icon={Globe} to="/network/networks" colour="text-green-500" />
            <StatCard title="Racks" value={(racks as any[]).length} icon={Server} to="/network/racks" colour="text-purple-500" />
            <StatCard title="Docs" value={totalArticles} icon={BookOpen} to="/docs" colour="text-yellow-500" />
            {isAdmin && (
              <StatCard title="Users" value={totalUsers} icon={Users} to="/admin/users" colour="text-pink-500" />
            )}
          </>
        )}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent open tickets */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Open Tickets</CardTitle>
            <Link to="/tickets" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {ticketsData?.data?.length === 0 ? (
              <p className="text-sm text-muted-foreground px-6 py-4">No open tickets.</p>
            ) : (
              <div className="divide-y">
                {ticketsData?.data?.map((ticket: {
                  id: string; ticketNumber: string; title: string;
                  priority: string; category: { name: string }; createdAt: string;
                }) => (
                  <Link
                    key={ticket.id}
                    to={`/tickets/${ticket.id}`}
                    className="flex items-center justify-between py-3 hover:bg-muted/50 px-6 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground w-20 shrink-0">{ticket.ticketNumber}</span>
                      <span className="text-sm font-medium truncate">{ticket.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <Badge variant={priorityVariant[ticket.priority] ?? 'secondary'}>{ticket.priority}</Badge>
                      <span className="text-xs text-muted-foreground hidden sm:block">{ticket.category?.name}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Module quick links */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground px-1">Quick access</p>
          <ModuleCard title="Tickets" description="Support requests & incidents" icon={Ticket} to="/tickets" colour="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" />
          <ModuleCard title="Assets" description="Hardware & software inventory" icon={Monitor} to="/assets" colour="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" />
          <ModuleCard title="Networks" description="IP ranges, VLANs & subnets" icon={Globe} to="/network/networks" colour="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" />
          <ModuleCard title="Racks" description="Physical rack layouts" icon={Server} to="/network/racks" colour="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" />
          <ModuleCard title="Docs" description="Knowledge base & articles" icon={BookOpen} to="/docs" colour="bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400" />
        </div>
      </div>

      {/* Tech/admin lower section */}
      {isTech && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Asset breakdown by type */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Assets by Type</CardTitle>
              <Link to="/assets" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {(assetSummary?.byType ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 py-4">No assets yet.</p>
              ) : (
                <div className="divide-y">
                  {(assetSummary?.byType ?? [])
                    .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
                    .map((row: { _id: string; count: number }) => {
                      const Icon = TYPE_ICON[row._id] ?? Package;
                      return (
                        <Link
                          key={row._id}
                          to={`/assets?type=${row._id}`}
                          className="flex items-center justify-between px-6 py-2.5 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm capitalize">{row._id.replace(/_/g, ' ')}</span>
                          </div>
                          <span className="text-sm font-medium tabular-nums">{row.count}</span>
                        </Link>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recently added assets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Recently Added Assets</CardTitle>
              <Link to="/assets" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {(recentAssets?.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 py-4">No assets yet.</p>
              ) : (
                <div className="divide-y">
                  {(recentAssets?.data ?? []).map((asset: { id: string; assetTag: string; name: string; type: string; status: string }) => {
                    const Icon = TYPE_ICON[asset.type] ?? Package;
                    return (
                      <Link
                        key={asset.id}
                        to={`/assets/${asset.id}`}
                        className="flex items-center justify-between px-6 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="font-mono text-xs text-muted-foreground shrink-0 w-20">{asset.assetTag}</span>
                          <span className="text-sm truncate">{asset.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs shrink-0 ml-2 capitalize">
                          {asset.status}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  );
}
