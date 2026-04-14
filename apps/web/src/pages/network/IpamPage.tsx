import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Pencil, Trash2, ScanLine, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getIpam, assignIp, updateIpAssignment, releaseIp, scanSubnet, type IpAssignment, type GridEntry, type ScanResult } from '@/api/ipam';
import { getAssets } from '@/api/assets';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

// ── Grid cell colours ─────────────────────────────────────────────────────────

const CELL_STYLES: Record<GridEntry['type'], string> = {
  free:      'bg-muted/40 hover:bg-primary/10 cursor-pointer border-transparent',
  static:    'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200',
  reserved:  'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200',
  dhcp:      'bg-purple-100 dark:bg-purple-900/40 border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200',
  gateway:   'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200',
  network:   'bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400',
  broadcast: 'bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400',
};

const TYPE_LABELS: Record<string, string> = {
  static: 'Static', reserved: 'Reserved', dhcp: 'DHCP',
};

// ── IP form modal ─────────────────────────────────────────────────────────────

function IpModal({
  open, onClose, networkId, prefillIp, editing,
}: {
  open: boolean; onClose: () => void; networkId: string; prefillIp?: string; editing?: IpAssignment;
}) {
  const queryClient = useQueryClient();
  const [address, setAddress] = useState(editing?.address ?? prefillIp ?? '');
  const [label,   setLabel]   = useState(editing?.label   ?? '');
  const [type,    setType]    = useState(editing?.type     ?? 'static');
  const [assetId, setAssetId] = useState(editing?.asset?.id ?? '');
  const [notes,   setNotes]   = useState(editing?.notes   ?? '');

  const { data: assetsData } = useQuery({
    queryKey: ['assets', { limit: 500 }],
    queryFn:  () => getAssets({ limit: 500 }),
  });
  const assets: any[] = assetsData?.data ?? [];

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      editing
        ? updateIpAssignment(networkId, editing.id, { label, type: type as any, assetId: assetId || null, notes: notes || undefined })
        : assignIp(networkId, { address, label, type, assetId: assetId || undefined, notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipam', networkId] });
      onClose();
    },
  });

  function handleClose() {
    setAddress(editing?.address ?? prefillIp ?? '');
    setLabel(editing?.label ?? '');
    setType(editing?.type ?? 'static');
    setAssetId(editing?.asset?.id ?? '');
    setNotes(editing?.notes ?? '');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Assignment' : 'Assign IP Address'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>IP Address <span className="text-destructive">*</span></Label>
            <Input
              value={address} onChange={(e) => setAddress(e.target.value)}
              placeholder="192.168.1.10" className="font-mono"
              disabled={!!editing}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Label / Hostname <span className="text-destructive">*</span></Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. server-01 or Printer - Finance" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as 'static' | 'reserved' | 'dhcp')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="static">Static</SelectItem>
                <SelectItem value="reserved">Reserved</SelectItem>
                <SelectItem value="dhcp">DHCP (tracked)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked Asset <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Select value={assetId || '__none__'} onValueChange={(v) => setAssetId(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="No asset" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No asset</SelectItem>
                {assets.map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.assetTag} — {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
          </div>
          {error && (
            <p className="text-sm text-destructive">{(error as any)?.response?.data?.error ?? 'An error occurred'}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !address.trim() || !label.trim()}>
            {isPending ? 'Saving...' : editing ? 'Save' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Subnet grid ───────────────────────────────────────────────────────────────

function SubnetGrid({ grid, onClickFree }: { grid: GridEntry[]; onClickFree: (ip: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hov = hovered ? grid.find((g) => g.ip === hovered) : null;

  return (
    <div className="space-y-2">
      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[
          { type: 'free',      label: 'Free' },
          { type: 'static',    label: 'Static' },
          { type: 'reserved',  label: 'Reserved' },
          { type: 'dhcp',      label: 'DHCP' },
          { type: 'gateway',   label: 'Gateway' },
          { type: 'network',   label: 'Net/Broadcast' },
        ].map(({ type, label }) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`inline-block w-3 h-3 rounded border ${CELL_STYLES[type as GridEntry['type']].split(' ')[0]}`} />
            {label}
          </span>
        ))}
      </div>

      {/* Tooltip */}
      <div className="h-6 text-xs text-muted-foreground font-mono">
        {hov && (
          <span>
            <strong>{hov.ip}</strong>
            {hov.label && ` — ${hov.label}`}
            {hov.assetName && ` (${hov.assetName})`}
            {hov.type === 'free' && ' — click to assign'}
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="flex flex-wrap gap-0.5">
        {grid.map((cell) => (
          <div
            key={cell.ip}
            title={[cell.ip, cell.label, cell.assetName].filter(Boolean).join(' — ')}
            className={`w-7 h-7 rounded border text-[9px] flex items-center justify-center font-mono transition-colors ${CELL_STYLES[cell.type]}`}
            onMouseEnter={() => setHovered(cell.ip)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => cell.type === 'free' ? onClickFree(cell.ip) : undefined}
          >
            {cell.ip.split('.')[3]}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scan results panel ────────────────────────────────────────────────────────

function ScanPanel({
  results, scanned, found, onAssign, onClose,
}: {
  results: ScanResult[]; scanned: number; found: number;
  onAssign: (selected: ScanResult[]) => void; onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(results.filter((r) => !r.alreadyAssigned).map((r) => r.ip)),
  );

  function toggle(ip: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(ip) ? n.delete(ip) : n.add(ip); return n; });
  }

  const toAssign = results.filter((r) => selected.has(r.ip) && !r.alreadyAssigned);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Scan complete — {found} host{found !== 1 ? 's' : ''} found of {scanned} scanned
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 text-xs">Dismiss</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Discovered via TCP probe. Devices with no open ports may not appear.
          Uncheck any you don't want to assign.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {results.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No responding hosts found.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="w-8 px-3 py-2" />
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-36">IP</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Hostname</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-32">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.ip} className="border-b last:border-0">
                    <td className="px-3 py-2 text-center">
                      {r.alreadyAssigned
                        ? <Check className="h-3.5 w-3.5 text-muted-foreground mx-auto" />
                        : <input type="checkbox" checked={selected.has(r.ip)} onChange={() => toggle(r.ip)} className="cursor-pointer" />
                      }
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.ip}</td>
                    <td className="px-3 py-2 text-xs">{r.hostname ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.alreadyAssigned
                        ? <span className="text-muted-foreground">Already assigned ({r.existingLabel})</span>
                        : <span className="text-green-600 font-medium">New</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {toAssign.length > 0 && (
              <div className="px-4 py-3 border-t">
                <Button size="sm" onClick={() => onAssign(toAssign)}>
                  <Plus className="h-3.5 w-3.5" /> Assign {toAssign.length} selected
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function IpamPage() {
  const { networkId } = useParams<{ networkId: string }>();
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const queryClient = useQueryClient();

  const [modalOpen,  setModalOpen]  = useState(false);
  const [prefillIp,  setPrefillIp]  = useState('');
  const [editing,    setEditing]    = useState<IpAssignment | undefined>();
  const [scanResults, setScanResults] = useState<{ results: ScanResult[]; scanned: number; found: number } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ipam', networkId],
    queryFn:  () => getIpam(networkId!),
    enabled:  !!networkId,
  });

  const { mutate: doRelease } = useMutation({
    mutationFn: (id: string) => releaseIp(networkId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ipam', networkId] }),
  });

  const { mutate: doScan, isPending: isScanning } = useMutation({
    mutationFn: () => scanSubnet(networkId!),
    onSuccess: (res) => setScanResults(res),
  });

  const { mutate: bulkAssign, isPending: isBulkAssigning } = useMutation({
    mutationFn: (selected: ScanResult[]) =>
      Promise.all(selected.map((r) =>
        assignIp(networkId!, { address: r.ip, label: r.hostname ?? r.ip, type: 'static' }),
      )),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipam', networkId] });
      setScanResults(null);
    },
  });

  function openAssign(ip = '') {
    setEditing(undefined);
    setPrefillIp(ip);
    setModalOpen(true);
  }

  function openEdit(assignment: IpAssignment) {
    setEditing(assignment);
    setPrefillIp('');
    setModalOpen(true);
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>;
  if (!data) return null;

  const { network, subnet, canVisualise, grid, assignments } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
          <Link to="/network/networks"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">IPAM — {network.name}</h1>
          <p className="text-sm text-muted-foreground font-mono">
            {network.address}{network.vlanId ? ` · VLAN ${network.vlanId}` : ''}
            {network.gateway ? ` · GW ${network.gateway}` : ''}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            {data?.canVisualise && (
              <Button variant="outline" onClick={() => doScan()} disabled={isScanning}>
                <ScanLine className="w-4 h-4" />
                {isScanning ? 'Scanning...' : 'Scan Subnet'}
              </Button>
            )}
            <Button onClick={() => openAssign()}>
              <Plus className="w-4 h-4" /> Assign IP
            </Button>
          </div>
        )}
      </div>

      {/* Subnet stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total addresses',  value: subnet.totalAddresses },
          { label: 'Usable addresses', value: subnet.usableAddresses },
          { label: 'Assigned',         value: subnet.usedAddresses,  colour: subnet.usedAddresses > 0 ? 'text-blue-600' : undefined },
          { label: 'Free',             value: subnet.freeAddresses,  colour: subnet.freeAddresses === 0 ? 'text-red-600' : 'text-green-600' },
        ].map((s) => (
          <Card key={s.label} className="py-3">
            <CardContent className="px-4 py-0">
              <p className={`text-2xl font-bold ${s.colour ?? ''}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subnet info */}
      <Card>
        <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><p className="text-xs text-muted-foreground">Network</p><code className="font-mono">{subnet.networkAddress}</code></div>
          <div><p className="text-xs text-muted-foreground">Broadcast</p><code className="font-mono">{subnet.broadcastAddress}</code></div>
          {network.gateway && <div><p className="text-xs text-muted-foreground">Gateway</p><code className="font-mono">{network.gateway}</code></div>}
          {network.dhcpEnabled && network.dhcpRange && <div><p className="text-xs text-muted-foreground">DHCP Range</p><code className="font-mono text-xs">{network.dhcpRange}</code></div>}
        </CardContent>
      </Card>

      {/* Visual grid */}
      {canVisualise ? (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium">Subnet map — /{subnet.prefix}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <SubnetGrid grid={grid} onClickFree={isAdmin ? openAssign : () => {}} />
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Subnet is too large (/{subnet.prefix}) for visual display — showing table only.
        </div>
      )}

      {/* Scan results */}
      {scanResults && (
        <ScanPanel
          results={scanResults.results}
          scanned={scanResults.scanned}
          found={scanResults.found}
          onAssign={(selected) => bulkAssign(selected)}
          onClose={() => setScanResults(null)}
        />
      )}

      {/* Assignment table */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm font-medium">Assigned addresses ({assignments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assignments.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No addresses assigned yet.{isAdmin && ' Click a free cell or use "Assign IP".'}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs w-36">IP Address</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Label / Hostname</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs w-24">Type</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Asset</th>
                  {isAdmin && <th className="w-20" />}
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-mono text-xs">{a.address}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{a.label}</p>
                      {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="text-xs">{TYPE_LABELS[a.type] ?? a.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {a.asset
                        ? <Link to={`/assets/${a.asset.id}`} className="hover:underline font-medium text-foreground">{a.asset.assetTag} — {a.asset.name}</Link>
                        : '—'}
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm(`Release ${a.address}?`)) doRelease(a.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <IpModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); setPrefillIp(''); }}
        networkId={networkId!}
        prefillIp={prefillIp}
        editing={editing}
      />
    </div>
  );
}
