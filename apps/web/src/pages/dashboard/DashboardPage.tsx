import { useQuery } from '@tanstack/react-query';
import {
  Ticket, Monitor, Globe, Server, BookOpen, Users,
  AlertTriangle, ArrowRight, Cpu, Printer,
  Router, Wifi, HardDrive, Package, KeyRound,
  CheckCircle2, XCircle, Clock, ShieldAlert,
  Activity, Radio,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';
import { getTickets } from '@/api/tickets';
import { getAssets } from '@/api/assets';
import { getDashboardStats } from '@/api/dashboard';
import { getMonitorStatus, type MonitorAsset } from '@/api/monitor';
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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

const PRIORITY_COLOUR: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-blue-400',
};

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low'];

const priorityVariant: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

// ── Integration status card ───────────────────────────────────────────────────

function IntegrationStatusCard({
  name, enabled, lastSyncAt, lastSyncStatus, to,
}: {
  name: string;
  enabled: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  to: string;
}) {
  const isSuccess = lastSyncStatus === 'success';
  const isFailed = lastSyncStatus === 'failed';

  return (
    <Link to={to}>
      <Card className="hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium text-sm">{name}</span>
            </div>
            {!enabled ? (
              <Badge variant="secondary" className="text-xs">Disabled</Badge>
            ) : isFailed ? (
              <Badge variant="destructive" className="text-xs">Failed</Badge>
            ) : isSuccess ? (
              <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Synced</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">Never synced</Badge>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            {isFailed ? (
              <XCircle className="h-3 w-3 text-destructive shrink-0" />
            ) : isSuccess ? (
              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
            ) : (
              <Clock className="h-3 w-3 shrink-0" />
            )}
            {lastSyncAt
              ? `Last sync ${timeAgo(lastSyncAt)}`
              : enabled ? 'No sync run yet' : 'Integration disabled'}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Network monitor widget ────────────────────────────────────────────────────

function MonitorStatusBadge({ status }: { status: MonitorAsset['status'] }) {
  if (status === 'up') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        Up
      </span>
    );
  }
  if (status === 'down') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <XCircle className="h-3.5 w-3.5" />
        Down
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

function NetworkMonitorWidget({ assets }: { assets: MonitorAsset[] }) {
  const downCount = assets.filter((a) => a.status === 'down').length;
  const upCount = assets.filter((a) => a.status === 'up').length;

  const sorted = [...assets].sort((a, b) => {
    const order = { down: 0, unknown: 1, up: 2 };
    return (order[a.status] ?? 1) - (order[b.status] ?? 1);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">Network Monitor</p>
          {downCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {downCount} down
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{upCount}/{assets.length} up</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {sorted.map((asset) => (
              <Link
                key={asset.assetId}
                to={`/assets/${asset.assetId}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Radio className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">{asset.ip ?? 'No IP'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  {asset.uptime24h !== null && (
                    <span className="text-xs text-muted-foreground hidden sm:block tabular-nums">
                      {asset.uptime24h}% 24h
                    </span>
                  )}
                  {asset.lastLatencyMs !== null && asset.status === 'up' && (
                    <span className="text-xs text-muted-foreground hidden sm:block tabular-nums w-14 text-right">
                      {asset.lastLatencyMs}ms
                    </span>
                  )}
                  <MonitorStatusBadge status={asset.status} />
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const isTech = user?.role !== UserRole.END_USER;

  const { data: stats } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 30_000,
  });

  const { data: ticketsData } = useQuery({
    queryKey: ['tickets', 'dashboard'],
    queryFn: () => getTickets({ limit: 6, status: 'open' }),
    staleTime: 30_000,
  });

  const { data: recentAssets } = useQuery({
    queryKey: ['assets', 'dashboard-recent'],
    queryFn: () => getAssets({ limit: 5, sort: 'createdAt', order: 'desc' }),
    enabled: isTech,
    staleTime: 30_000,
  });

  const { data: monitorData } = useQuery({
    queryKey: ['monitor', 'status'],
    queryFn: getMonitorStatus,
    enabled: isTech,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });

  const openTickets = stats?.tickets.open ?? 0;
  const inProgressTickets = stats?.tickets.inProgress ?? 0;
  const totalOpen = openTickets + inProgressTickets;

  // Sort open-by-priority in display order
  const byPriority = PRIORITY_ORDER.map((p) => ({
    priority: p,
    count: stats?.tickets.byPriority?.find((x) => x._id === p)?.count ?? 0,
  })).filter((x) => x.count > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Welcome back, {user?.displayName}</p>
      </div>

      {/* Warranty expiry alert */}
      {isTech && (stats?.assets?.warrantyExpiringSoon ?? 0) > 0 && (
        <Link to="/assets?warrantyExpiry=30">
          <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 px-4 py-2.5 text-sm text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>
              <span className="font-semibold">{stats!.assets!.warrantyExpiringSoon} asset{stats!.assets!.warrantyExpiringSoon !== 1 ? 's' : ''}</span>
              {' '}with warranty expiring in the next 30 days
            </span>
            <ArrowRight className="h-3.5 w-3.5 ml-auto shrink-0" />
          </div>
        </Link>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard title="Open Tickets" value={openTickets} icon={Ticket} to="/tickets?status=open" colour="text-orange-500" />
        <StatCard title="In Progress" value={inProgressTickets} icon={Clock} to="/tickets?status=in_progress" colour="text-blue-500" />
        {isTech && (
          <>
            <StatCard title="Active Assets" value={stats?.assets?.active ?? '—'} icon={Monitor} to="/assets" colour="text-emerald-500" />
            <StatCard title="Vault Credentials" value={stats?.vault?.total ?? '—'} icon={KeyRound} to="/vault" colour="text-indigo-500" />
            <StatCard title="Networks" value={stats?.networks?.total ?? '—'} icon={Globe} to="/network/networks" colour="text-cyan-500" />
            <StatCard title="Docs" value={stats?.articles?.total ?? '—'} icon={BookOpen} to="/docs" colour="text-yellow-500" />
          </>
        )}
        {isAdmin && (
          <StatCard title="Active Users" value={stats?.users?.total ?? '—'} icon={Users} to="/admin/users" colour="text-pink-500" />
        )}
      </div>

      {/* Tickets row */}
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

        {/* Open tickets by priority */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Open by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            {byPriority.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open tickets.</p>
            ) : (
              <div className="space-y-3">
                {byPriority.map(({ priority, count }) => (
                  <Link
                    key={priority}
                    to={`/tickets?status=open&priority=${priority}`}
                    className="block group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm capitalize">{priority}</span>
                      <span className="text-sm font-medium tabular-nums">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${PRIORITY_COLOUR[priority]}`}
                        style={{ width: `${Math.round((count / totalOpen) * 100)}%` }}
                      />
                    </div>
                  </Link>
                ))}
                <p className="text-xs text-muted-foreground pt-1">
                  {totalOpen} total open
                </p>
              </div>
            )}
          </CardContent>
        </Card>
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
              {(stats?.assets?.byType ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 py-4">No assets yet.</p>
              ) : (
                <div className="divide-y">
                  {[...(stats?.assets?.byType ?? [])]
                    .sort((a, b) => b.count - a.count)
                    .map((row) => {
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
                  {(recentAssets?.data ?? []).map((asset: {
                    id: string; assetTag: string; name: string; type: string; status: string;
                  }) => {
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

      {/* Network monitor */}
      {isTech && monitorData && monitorData.length > 0 && (
        <NetworkMonitorWidget assets={monitorData} />
      )}

      {/* Admin: integration sync status */}
      {isAdmin && stats?.integrations && (
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-3">Integration Sync</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <IntegrationStatusCard
              name="Microsoft Intune"
              enabled={stats.integrations.intune.enabled}
              lastSyncAt={stats.integrations.intune.lastSyncAt}
              lastSyncStatus={stats.integrations.intune.lastSyncStatus}
              to="/admin/integrations"
            />
            <IntegrationStatusCard
              name="Cisco Meraki"
              enabled={stats.integrations.meraki.enabled}
              lastSyncAt={stats.integrations.meraki.lastSyncAt}
              lastSyncStatus={stats.integrations.meraki.lastSyncStatus}
              to="/admin/integrations"
            />
          </div>
        </div>
      )}
    </div>
  );
}
