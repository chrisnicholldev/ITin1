import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, CheckCircle2, XCircle, Clock, Plug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  getIntuneStatus, triggerIntuneSync, getIntuneLogs,
  getMerakiStatus, triggerMerakiSync, getMerakiLogs,
} from '@/api/integrations';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(ms?: number) {
  if (!ms) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(d?: string | Date) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}

function StatusBadge({ status }: { status?: 'running' | 'success' | 'failed' }) {
  if (status === 'success') return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800">
      <CheckCircle2 className="h-3 w-3" /> Success
    </span>
  );
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">
      <XCircle className="h-3 w-3" /> Failed
    </span>
  );
  if (status === 'running') return (
    <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
      <RefreshCw className="h-3 w-3 animate-spin" /> Running
    </span>
  );
  return <span className="text-muted-foreground text-xs">—</span>;
}

// ── Shared integration card ───────────────────────────────────────────────────

function IntegrationCard({
  title,
  description,
  envNote,
  status,
  statusLoading,
  logs,
  logsLoading,
  configured,
  onSync,
  syncing,
  syncError,
}: {
  title: string;
  description: string;
  envNote: string;
  status: any;
  statusLoading: boolean;
  logs: any[];
  logsLoading: boolean;
  configured: boolean;
  onSync: () => void;
  syncing: boolean;
  syncError: string | null;
}) {
  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
              status?.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}>
              {status?.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <p className="text-sm text-muted-foreground">Loading status...</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Configuration</p>
                  <p className="font-medium">
                    {configured
                      ? <span className="text-green-700">Configured</span>
                      : <span className="text-amber-600">Not configured</span>}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Schedule</p>
                  <p className="font-mono text-xs">{status?.syncSchedule ?? '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Last sync</p>
                  <p>{status?.lastSync ? formatDate(status.lastSync.startedAt) : 'Never'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Last result</p>
                  <StatusBadge status={status?.lastSync?.status} />
                </div>
              </div>

              {status?.lastSync && (
                <div className="grid grid-cols-4 gap-3 text-sm bg-muted/40 rounded-md p-3">
                  <div className="text-center">
                    <p className="text-2xl font-semibold">{status.lastSync.devicesFound ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Devices found</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-green-700">{status.lastSync.created ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Created</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-blue-700">{status.lastSync.updated ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Updated</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-red-600">{status.lastSync.failed ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
              )}

              {status?.queuedJobs > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {status.queuedJobs} job{status.queuedJobs !== 1 ? 's' : ''} in queue
                </p>
              )}

              {status?.lastSync?.status === 'failed' && logs[0]?.syncErrors?.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
                  <p className="text-xs font-medium text-destructive mb-1">Last sync error</p>
                  <p className="text-xs text-destructive/80 font-mono break-all">{logs[0].syncErrors[0]}</p>
                </div>
              )}

              {syncError && <p className="text-xs text-destructive">{syncError}</p>}

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!status?.enabled || !configured || syncing}
                  onClick={onSync}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Queuing...' : 'Sync Now'}
                </Button>
              </div>

              {!status?.enabled && (
                <p className="text-xs text-muted-foreground">
                  Set <code className="bg-muted px-1 rounded">{envNote}</code> and provide credentials in your{' '}
                  <code className="bg-muted px-1 rounded">.env</code> to enable.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Sync log table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title} — Sync History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <p className="text-sm text-muted-foreground px-4 py-6">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sync runs yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Started</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Trigger</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Found</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Created</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Updated</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Failed</th>
                  <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Duration</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log._id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(log.startedAt)}</td>
                    <td className="px-4 py-3 capitalize">{log.triggeredBy}</td>
                    <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                    <td className="px-4 py-3 text-right">{log.devicesFound}</td>
                    <td className="px-4 py-3 text-right text-green-700">{log.created}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{log.updated}</td>
                    <td className="px-4 py-3 text-right text-red-600">{log.failed}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatDuration(log.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [intuneError, setIntuneError] = useState<string | null>(null);
  const [merakiError, setMerakiError] = useState<string | null>(null);

  // Intune
  const { data: intuneStatus, isLoading: intuneStatusLoading } = useQuery({
    queryKey: ['intune-status'],
    queryFn: getIntuneStatus,
    refetchInterval: 10_000,
  });
  const { data: intuneLogsData, isLoading: intuneLogsLoading } = useQuery({
    queryKey: ['intune-logs'],
    queryFn: getIntuneLogs,
    refetchInterval: 15_000,
  });
  const { mutate: syncIntune, isPending: intuneSyncing } = useMutation({
    mutationFn: triggerIntuneSync,
    onSuccess: () => {
      setIntuneError(null);
      queryClient.invalidateQueries({ queryKey: ['intune-status'] });
      queryClient.invalidateQueries({ queryKey: ['intune-logs'] });
    },
    onError: (err: any) => setIntuneError(err?.response?.data?.error ?? 'Failed to trigger sync'),
  });

  // Meraki
  const { data: merakiStatus, isLoading: merakiStatusLoading } = useQuery({
    queryKey: ['meraki-status'],
    queryFn: getMerakiStatus,
    refetchInterval: 10_000,
  });
  const { data: merakiLogsData, isLoading: merakiLogsLoading } = useQuery({
    queryKey: ['meraki-logs'],
    queryFn: getMerakiLogs,
    refetchInterval: 15_000,
  });
  const { mutate: syncMeraki, isPending: merakiSyncing } = useMutation({
    mutationFn: triggerMerakiSync,
    onSuccess: () => {
      setMerakiError(null);
      queryClient.invalidateQueries({ queryKey: ['meraki-status'] });
      queryClient.invalidateQueries({ queryKey: ['meraki-logs'] });
    },
    onError: (err: any) => setMerakiError(err?.response?.data?.error ?? 'Failed to trigger sync'),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="h-6 w-6" /> Integrations
        </h1>
        <p className="text-sm text-muted-foreground">Manage external data source sync</p>
      </div>

      <IntegrationCard
        title="Microsoft Intune"
        description="Sync managed devices into the asset registry via Microsoft Graph API"
        envNote="INTUNE_ENABLED=true"
        status={intuneStatus}
        statusLoading={intuneStatusLoading}
        logs={intuneLogsData?.data ?? []}
        logsLoading={intuneLogsLoading}
        configured={!!(intuneStatus?.tenantConfigured)}
        onSync={() => syncIntune()}
        syncing={intuneSyncing}
        syncError={intuneError}
      />

      <IntegrationCard
        title="Cisco Meraki"
        description="Sync network devices (switches, APs, firewalls) from Meraki Dashboard"
        envNote="MERAKI_ENABLED=true"
        status={merakiStatus}
        statusLoading={merakiStatusLoading}
        logs={merakiLogsData?.data ?? []}
        logsLoading={merakiLogsLoading}
        configured={!!(merakiStatus?.apiKeyConfigured)}
        onSync={() => syncMeraki()}
        syncing={merakiSyncing}
        syncError={merakiError}
      />
    </div>
  );
}
