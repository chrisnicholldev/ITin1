import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, CheckCircle2, XCircle, Clock, Plug,
  ChevronLeft, ChevronRight, Settings, Eye, EyeOff, ChevronDown, ChevronUp, Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  getIntuneStatus, triggerIntuneSync, getIntuneLogs,
  getMerakiStatus, triggerMerakiSync, getMerakiLogs,
  getAdStatus, triggerAdSync, getAdLogs,
  getIntegrationConfig, updateIntuneConfig, updateMerakiConfig, updateAdConfig, updateSmtpConfig, sendSmtpTestEmail,
  type IntegrationConfig,
} from '@/api/integrations';
import { Mail } from 'lucide-react';

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

// ── Secret input ──────────────────────────────────────────────────────────────

function SecretInput({ value, onChange, placeholder, hasExisting }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hasExisting: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hasExisting ? '(leave blank to keep current)' : placeholder}
        className="pr-9"
      />
      <button
        type="button"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setShow(!show)}
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

// ── Setup guide ───────────────────────────────────────────────────────────────

function SetupGuide({ title, steps }: { title: string; steps: (string | React.ReactNode)[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 text-sm">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-blue-800 dark:text-blue-300 font-medium hover:bg-blue-100 dark:hover:bg-blue-950/50 rounded-md transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Info className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
      </button>
      {open && (
        <ol className="px-4 pb-3 pt-1 space-y-1.5 text-blue-900 dark:text-blue-200 list-decimal list-inside">
          {steps.map((step, i) => (
            <li key={i} className="leading-snug">{step}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ── Intune config form ────────────────────────────────────────────────────────

function IntuneConfigForm({ config, onSaved }: { config: IntegrationConfig['intune']; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(config.enabled);
  const [tenantId, setTenantId] = useState(config.tenantId);
  const [clientId, setClientId] = useState(config.clientId);
  const [clientSecret, setClientSecret] = useState('');
  const [syncSchedule, setSyncSchedule] = useState(config.syncSchedule);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => updateIntuneConfig({ enabled, tenantId, clientId, clientSecret, syncSchedule }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-config'] });
      queryClient.invalidateQueries({ queryKey: ['intune-status'] });
      onSaved();
    },
  });

  return (
    <div className="space-y-3 pt-2">
      <SetupGuide title="How to set up Microsoft Intune integration" steps={[
        <>Go to <strong>portal.azure.com</strong> → Azure Active Directory → App registrations → New registration. Name it (e.g. "ITin1 Sync") and register.</>,
        <>Under the new app, go to <strong>Certificates &amp; secrets</strong> → New client secret. Copy the value immediately — it won't be shown again.</>,
        <>Go to <strong>API permissions</strong> → Add a permission → Microsoft Graph → Application permissions. Add <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">DeviceManagementManagedDevices.Read.All</code> and <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">User.Read.All</code>.</>,
        <>Click <strong>Grant admin consent</strong> for your organisation.</>,
        <>Copy the <strong>Tenant ID</strong> and <strong>Client ID</strong> from the app's Overview page and paste them below.</>,
        <>The sync schedule uses cron syntax — e.g. <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">0 */6 * * *</code> syncs every 6 hours.</>,
      ]} />
      <div className="flex items-center gap-2">
        <input type="checkbox" id="intune-enabled" className="h-4 w-4"
          checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <Label htmlFor="intune-enabled" className="font-normal cursor-pointer">Enable Intune sync</Label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Tenant ID</Label>
          <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>
        <div className="space-y-1.5">
          <Label>Client ID</Label>
          <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>
        <div className="space-y-1.5">
          <Label>Client Secret {config.hasClientSecret && <span className="text-green-700 text-xs">(saved)</span>}</Label>
          <SecretInput value={clientSecret} onChange={setClientSecret}
            placeholder="Paste client secret" hasExisting={config.hasClientSecret} />
        </div>
        <div className="space-y-1.5">
          <Label>Sync Schedule <span className="text-xs text-muted-foreground">(cron)</span></Label>
          <Input value={syncSchedule} onChange={(e) => setSyncSchedule(e.target.value)} placeholder="0 */6 * * *" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{(error as any)?.response?.data?.error ?? 'Failed to save'}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => mutate()} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save Intune Config'}
        </Button>
      </div>
    </div>
  );
}

// ── Meraki config form ────────────────────────────────────────────────────────

function MerakiConfigForm({ config, onSaved }: { config: IntegrationConfig['meraki']; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(config.enabled);
  const [apiKey, setApiKey] = useState('');
  const [orgId, setOrgId] = useState(config.orgId);
  const [syncSchedule, setSyncSchedule] = useState(config.syncSchedule);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => updateMerakiConfig({ enabled, apiKey, orgId, syncSchedule }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-config'] });
      queryClient.invalidateQueries({ queryKey: ['meraki-status'] });
      onSaved();
    },
  });

  return (
    <div className="space-y-3 pt-2">
      <SetupGuide title="How to set up Cisco Meraki integration" steps={[
        <>Log in to <strong>dashboard.meraki.com</strong> and go to your profile (top-right).</>,
        <>Scroll to the <strong>API access</strong> section and click <strong>Generate new API key</strong>. Copy it — it won't be shown again.</>,
        <>Ensure API access is enabled for your organisation under <strong>Organisation → Settings → Dashboard API access</strong>.</>,
        <>The Organisation ID is optional — leave it blank to auto-detect. You can find it under <strong>Organisation → Settings</strong> in the URL or overview.</>,
        <>The sync will import all MX, MS, MR, and MG devices as assets with type Network Device.</>,
      ]} />
      <div className="flex items-center gap-2">
        <input type="checkbox" id="meraki-enabled" className="h-4 w-4"
          checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <Label htmlFor="meraki-enabled" className="font-normal cursor-pointer">Enable Meraki sync</Label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>API Key {config.hasApiKey && <span className="text-green-700 text-xs">(saved)</span>}</Label>
          <SecretInput value={apiKey} onChange={setApiKey}
            placeholder="Paste Meraki API key" hasExisting={config.hasApiKey} />
        </div>
        <div className="space-y-1.5">
          <Label>Organisation ID <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Input value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="Auto-detected if left blank" />
        </div>
        <div className="space-y-1.5">
          <Label>Sync Schedule <span className="text-xs text-muted-foreground">(cron)</span></Label>
          <Input value={syncSchedule} onChange={(e) => setSyncSchedule(e.target.value)} placeholder="0 */6 * * *" />
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{(error as any)?.response?.data?.error ?? 'Failed to save'}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => mutate()} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save Meraki Config'}
        </Button>
      </div>
    </div>
  );
}

// ── AD config form ────────────────────────────────────────────────────────────

function AdConfigForm({ config, onSaved }: { config: IntegrationConfig['ad']; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(config.enabled);
  const [url, setUrl] = useState(config.url);
  const [bindDn, setBindDn] = useState(config.bindDn);
  const [bindCredentials, setBindCredentials] = useState('');
  const [searchBase, setSearchBase] = useState(config.searchBase);
  const [computerFilter, setComputerFilter] = useState(config.computerFilter || '(objectClass=computer)');
  const [syncSchedule, setSyncSchedule] = useState(config.syncSchedule);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => updateAdConfig({ enabled, url, bindDn, bindCredentials, searchBase, computerFilter, syncSchedule }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-config'] });
      queryClient.invalidateQueries({ queryKey: ['ad-status'] });
      onSaved();
    },
  });

  return (
    <div className="space-y-3 pt-2">
      <SetupGuide title="How to set up Active Directory integration" steps={[
        <>Create a dedicated <strong>read-only service account</strong> in AD (e.g. <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">svc-itdesk</code>) with permission to read computer objects in the target OU(s).</>,
        <>The <strong>LDAP URL</strong> should point to a domain controller — e.g. <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">ldap://dc.domain.local</code> or <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">ldaps://dc.domain.local:636</code> for SSL.</>,
        <>The <strong>Search Base</strong> is the root DN to search from — e.g. <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">DC=domain,DC=local</code>. Narrow it to a specific OU if needed: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">OU=Computers,DC=domain,DC=local</code></>,
        <>The <strong>Bind DN</strong> is the full distinguished name of the service account — e.g. <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">CN=svc-itdesk,OU=Service Accounts,DC=domain,DC=local</code></>,
        <>The default <strong>Computer Filter</strong> <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">(objectClass=computer)</code> pulls all computers. Scope it further, e.g. <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">(&amp;(objectClass=computer)(operatingSystem=*Server*))</code> for servers only.</>,
        <>Devices already in Intune are matched by hostname and merged — AD fields are added without overwriting Intune data.</>,
      ]} />
      <div className="flex items-center gap-2">
        <input type="checkbox" id="ad-enabled" className="h-4 w-4"
          checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <Label htmlFor="ad-enabled" className="font-normal cursor-pointer">Enable Active Directory sync</Label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>LDAP URL</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="ldap://dc.domain.local" />
        </div>
        <div className="space-y-1.5">
          <Label>Search Base</Label>
          <Input value={searchBase} onChange={(e) => setSearchBase(e.target.value)} placeholder="DC=domain,DC=local" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Bind DN <span className="text-xs text-muted-foreground">(service account)</span></Label>
          <Input value={bindDn} onChange={(e) => setBindDn(e.target.value)} placeholder="CN=svc-itdesk,OU=Service Accounts,DC=domain,DC=local" />
        </div>
        <div className="space-y-1.5">
          <Label>Bind Password {config.hasBindCredentials && <span className="text-green-700 text-xs">(saved)</span>}</Label>
          <SecretInput value={bindCredentials} onChange={setBindCredentials}
            placeholder="Service account password" hasExisting={config.hasBindCredentials} />
        </div>
        <div className="space-y-1.5">
          <Label>Sync Schedule <span className="text-xs text-muted-foreground">(cron)</span></Label>
          <Input value={syncSchedule} onChange={(e) => setSyncSchedule(e.target.value)} placeholder="0 */6 * * *" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Computer Filter <span className="text-xs text-muted-foreground">(LDAP filter — optional)</span></Label>
          <Input value={computerFilter} onChange={(e) => setComputerFilter(e.target.value)} placeholder="(objectClass=computer)" />
          <p className="text-xs text-muted-foreground">Scope to specific OUs or OS types, e.g. <code>(&(objectClass=computer)(operatingSystem=*Server*))</code></p>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{(error as any)?.response?.data?.error ?? 'Failed to save'}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => mutate()} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save AD Config'}
        </Button>
      </div>
    </div>
  );
}

// ── Paginated sync history ────────────────────────────────────────────────────

const PAGE_SIZE = 8;

function SyncHistoryTable({ title, logs, loading }: { title: string; logs: any[]; loading: boolean }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const slice = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title} — Sync History</CardTitle>
          {logs.length > 0 && <span className="text-xs text-muted-foreground">{logs.length} runs</span>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <p className="text-sm text-muted-foreground px-4 py-6">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No sync runs yet.</p>
        ) : (
          <>
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
                {slice.map((log: any) => (
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
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t">
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Integration card ──────────────────────────────────────────────────────────

function IntegrationCard({
  title, description, status, statusLoading, logs, logsLoading,
  configured, onSync, syncing, syncError,
  configForm,
}: {
  title: string;
  description: string;
  status: any;
  statusLoading: boolean;
  logs: any[];
  logsLoading: boolean;
  configured: boolean;
  onSync: () => void;
  syncing: boolean;
  syncError: string | null;
  configForm: React.ReactNode;
}) {
  const [configOpen, setConfigOpen] = useState(false);

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
                  <p className="text-muted-foreground text-xs mb-0.5">Credentials</p>
                  <p className="font-medium">
                    {configured
                      ? <span className="text-green-700">Configured</span>
                      : <span className="text-amber-600">Not configured</span>}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Last sync</p>
                  <p>{status?.lastSync ? formatDate(status.lastSync.startedAt) : 'Never'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Last result</p>
                  <StatusBadge status={status?.lastSync?.status} />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-0.5">Queue</p>
                  <p className="flex items-center gap-1 text-muted-foreground">
                    {status?.queuedJobs > 0
                      ? <><Clock className="h-3 w-3" /> {status.queuedJobs} pending</>
                      : 'Idle'}
                  </p>
                </div>
              </div>

              {status?.lastSync && (
                <div className="grid grid-cols-4 gap-3 text-sm bg-muted/40 rounded-md p-3">
                  <div className="text-center">
                    <p className="text-2xl font-semibold">{status.lastSync.devicesFound ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Found</p>
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

              {syncError && <p className="text-xs text-destructive">{syncError}</p>}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!status?.enabled || !configured || syncing}
                  onClick={onSync} className="gap-1.5">
                  <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Queuing...' : 'Sync Now'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfigOpen(!configOpen)} className="gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Configure
                  {configOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {configOpen && (
                <div className="border rounded-md p-4 bg-muted/20">
                  {configForm}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <SyncHistoryTable title={title} logs={logs} loading={logsLoading} />
    </>
  );
}

// ── SMTP config card (standalone — no sync) ───────────────────────────────────

function SmtpConfigCard({ config }: { config: IntegrationConfig['smtp'] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(config.enabled);
  const [host, setHost] = useState(config.host);
  const [port, setPort] = useState(String(config.port || 587));
  const [user, setUser] = useState(config.user);
  const [pass, setPass] = useState('');
  const [from, setFrom] = useState(config.from);

  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  useEffect(() => {
    if (!open) {
      setEnabled(config.enabled);
      setHost(config.host);
      setPort(String(config.port || 587));
      setUser(config.user);
      setFrom(config.from);
    }
  }, [config]);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => updateSmtpConfig({ enabled, host, port: Number(port), user, pass, from }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-config'] });
      setOpen(false);
    },
  });

  const { mutate: sendTest, isPending: testPending } = useMutation({
    mutationFn: () => sendSmtpTestEmail(testEmail),
    onSuccess: () => { setTestResult('ok'); setTestError(''); },
    onError: (err: any) => { setTestResult('error'); setTestError(err?.response?.data?.error ?? 'Failed to send'); },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" /> Email (SMTP)
            </CardTitle>
            <CardDescription>Outbound email for ticket notifications</CardDescription>
          </div>
          <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
            config.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Host</p>
            <p className="font-medium">{config.host || <span className="text-muted-foreground">Not set</span>}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Port</p>
            <p>{config.port || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Password</p>
            <p>{config.hasPassword ? <span className="text-green-700">Saved</span> : <span className="text-amber-600">Not set</span>}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)} className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Configure
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {config.host && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Send test email to…"
                value={testEmail}
                onChange={(e) => { setTestEmail(e.target.value); setTestResult('idle'); }}
                className="h-8 text-sm max-w-xs"
              />
              <Button size="sm" variant="outline" disabled={testPending || !testEmail}
                onClick={() => sendTest()}>
                {testPending ? 'Sending…' : 'Send Test'}
              </Button>
            </div>
            {testResult === 'ok' && <p className="text-xs text-green-700">Test email sent successfully.</p>}
            {testResult === 'error' && <p className="text-xs text-destructive">{testError}</p>}
          </div>
        )}

        {open && (
          <div className="border rounded-md p-4 bg-muted/20 space-y-3">
            <SetupGuide title="How to set up SMTP email" steps={[
              <>For <strong>Microsoft 365</strong>: use host <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">smtp.office365.com</code>, port <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">587</code>. Username is the full email address. If MFA is enabled on the account, create an <strong>App Password</strong> in the Microsoft account security settings.</>,
              <>For <strong>Gmail / Google Workspace</strong>: host <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">smtp.gmail.com</code>, port <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">587</code>. Use an <strong>App Password</strong> (requires 2-Step Verification enabled).</>,
              <>For <strong>on-prem Exchange</strong>: use your Exchange server hostname or IP, port <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">25</code> or <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">587</code>. A relay connector with IP-based auth may allow leaving username/password blank.</>,
              <>The <strong>From Address</strong> can include a display name: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">IT Helpdesk &lt;itdesk@yourdomain.com&gt;</code></>,
              <>Emails are sent for: new ticket created, ticket assigned, status changed, and new comment added.</>,
            ]} />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="smtp-enabled" className="h-4 w-4"
                checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <Label htmlFor="smtp-enabled" className="font-normal cursor-pointer">Enable email notifications</Label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SMTP Host</Label>
                <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.office365.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" />
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="itdesk@yourdomain.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Password {config.hasPassword && <span className="text-green-700 text-xs">(saved)</span>}</Label>
                <SecretInput value={pass} onChange={setPass}
                  placeholder="SMTP password or app password" hasExisting={config.hasPassword} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>From Address</Label>
                <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="IT Helpdesk <itdesk@yourdomain.com>" />
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{(error as any)?.response?.data?.error ?? 'Failed to save'}</p>}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => mutate()} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save SMTP Config'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [intuneError, setIntuneError] = useState<string | null>(null);
  const [merakiError, setMerakiError] = useState<string | null>(null);
  const [adError, setAdError] = useState<string | null>(null);

  const { data: integrationConfig } = useQuery({
    queryKey: ['integration-config'],
    queryFn: getIntegrationConfig,
  });

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

  // AD
  const { data: adStatus, isLoading: adStatusLoading } = useQuery({
    queryKey: ['ad-status'],
    queryFn: getAdStatus,
    refetchInterval: 10_000,
  });
  const { data: adLogsData, isLoading: adLogsLoading } = useQuery({
    queryKey: ['ad-logs'],
    queryFn: getAdLogs,
    refetchInterval: 15_000,
  });
  const { mutate: syncAd, isPending: adSyncing } = useMutation({
    mutationFn: triggerAdSync,
    onSuccess: () => {
      setAdError(null);
      queryClient.invalidateQueries({ queryKey: ['ad-status'] });
      queryClient.invalidateQueries({ queryKey: ['ad-logs'] });
    },
    onError: (err: any) => setAdError(err?.response?.data?.error ?? 'Failed to trigger sync'),
  });

  const defaultIntuneConfig = {
    enabled: false, tenantId: '', clientId: '', hasClientSecret: false, syncSchedule: '',
  };
  const defaultMerakiConfig = {
    enabled: false, hasApiKey: false, orgId: '', syncSchedule: '',
  };
  const defaultAdConfig = {
    enabled: false, url: '', bindDn: '', hasBindCredentials: false,
    searchBase: '', computerFilter: '(objectClass=computer)', syncSchedule: '',
  };
  const defaultSmtpConfig = {
    enabled: false, host: '', port: 587, user: '', hasPassword: false, from: '',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Plug className="h-6 w-6" /> Integrations
        </h1>
        <p className="text-sm text-muted-foreground">Configure and manage external data sources</p>
      </div>

      <IntegrationCard
        title="Microsoft Intune"
        description="Sync managed devices into the asset registry via Microsoft Graph API"
        status={intuneStatus}
        statusLoading={intuneStatusLoading}
        logs={intuneLogsData?.data ?? []}
        logsLoading={intuneLogsLoading}
        configured={!!(intuneStatus?.tenantConfigured)}
        onSync={() => syncIntune()}
        syncing={intuneSyncing}
        syncError={intuneError}
        configForm={
          <IntuneConfigForm
            config={integrationConfig?.intune ?? defaultIntuneConfig}
            onSaved={() => {}}
          />
        }
      />

      <IntegrationCard
        title="Cisco Meraki"
        description="Sync network devices (switches, APs, firewalls) from Meraki Dashboard"
        status={merakiStatus}
        statusLoading={merakiStatusLoading}
        logs={merakiLogsData?.data ?? []}
        logsLoading={merakiLogsLoading}
        configured={!!(merakiStatus?.apiKeyConfigured)}
        onSync={() => syncMeraki()}
        syncing={merakiSyncing}
        syncError={merakiError}
        configForm={
          <MerakiConfigForm
            config={integrationConfig?.meraki ?? defaultMerakiConfig}
            onSaved={() => {}}
          />
        }
      />

      <SmtpConfigCard config={integrationConfig?.smtp ?? defaultSmtpConfig} />

      <IntegrationCard
        title="Active Directory"
        description="Sync on-prem computer objects (servers, workstations) from your AD domain"
        status={adStatus}
        statusLoading={adStatusLoading}
        logs={adLogsData?.data ?? []}
        logsLoading={adLogsLoading}
        configured={!!(adStatus?.configured)}
        onSync={() => syncAd()}
        syncing={adSyncing}
        syncError={adError}
        configForm={
          <AdConfigForm
            config={integrationConfig?.ad ?? defaultAdConfig}
            onSaved={() => {}}
          />
        }
      />
    </div>
  );
}
