import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search, Globe, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAssets, updateAsset } from '@/api/assets';
import { getNetworks } from '@/api/networks';
import { AssetType, AssetStatus, ExternalSource } from '@itdesk/shared';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

const statusVariant: Record<string, string> = {
  active: 'success', inactive: 'secondary', decommissioned: 'outline',
  in_repair: 'warning', in_stock: 'info',
};

const SOURCE_LABELS: Record<string, string> = { intune: 'Intune', meraki: 'Meraki', manual: 'Manual' };
const SOURCE_COLOURS: Record<string, string> = {
  intune: 'bg-blue-100 text-blue-800',
  meraki: 'bg-orange-100 text-orange-800',
};

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export function AssetsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkNetworkId, setBulkNetworkId] = useState('');
  const [bulkDone, setBulkDone] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['assets', { search, type, status, source, page, limit }],
    queryFn: () => getAssets({ ...(search && { search }), ...(type && { type }), ...(status && { status }), ...(source && { externalSource: source }), page, limit }),
  });

  const { data: networks = [] } = useQuery({
    queryKey: ['networks'],
    queryFn: () => getNetworks(),
    enabled: isAdmin,
  });

  const assets = data?.data ?? [];
  const meta = data?.meta;
  const allPageIds = assets.map((a: any) => a.id);
  const allSelected = allPageIds.length > 0 && allPageIds.every((id: string) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const n = new Set(prev); allPageIds.forEach((id: string) => n.delete(id)); return n; });
    } else {
      setSelected((prev) => { const n = new Set(prev); allPageIds.forEach((id: string) => n.add(id)); return n; });
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const { mutate: bulkAssignNetwork, isPending: bulkPending } = useMutation({
    mutationFn: async (networkId: string) => {
      const ids = Array.from(selected);
      setBulkDone(0);
      await Promise.all(ids.map(async (id) => {
        await updateAsset(id, { networkId: networkId || undefined } as any);
        setBulkDone((d) => d + 1);
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setSelected(new Set());
      setBulkNetworkId('');
      setBulkDone(0);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assets</h1>
          <p className="text-sm text-muted-foreground">Assets</p>
        </div>
        <Button asChild>
          <Link to="/assets/new"><Plus className="w-4 h-4" /> Add Asset</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search assets..." className="pl-9" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.values(AssetType).map((t) => (
              <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.values(AssetStatus).map((s) => (
              <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={source} onValueChange={(v) => { setSource(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Source" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            {Object.values(ExternalSource).filter(s => s !== 'manual').map((s) => (
              <SelectItem key={s} value={s}>{SOURCE_LABELS[s] ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action toolbar */}
      {someSelected && isAdmin && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg flex-wrap">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={bulkNetworkId} onValueChange={setBulkNetworkId}>
              <SelectTrigger className="w-64 h-8 text-sm"><SelectValue placeholder="Assign to network…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Remove network —</SelectItem>
                {(networks as any[]).map((n: any) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}{n.vlanId ? ` (VLAN ${n.vlanId})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8 gap-1.5"
              disabled={!bulkNetworkId || bulkPending}
              onClick={() => bulkAssignNetwork(bulkNetworkId === 'none' ? '' : bulkNetworkId)}>
              {bulkPending
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{bulkDone}/{selected.size}</>
                : <><Check className="h-3.5 w-3.5" />Apply</>}
            </Button>
          </div>
          <Button size="sm" variant="ghost" className="h-8 gap-1 ml-auto"
            onClick={() => { setSelected(new Set()); setBulkNetworkId(''); }}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {/* Column headers */}
          <div className="hidden lg:flex items-center gap-4 px-4 py-2 border-b text-xs text-muted-foreground">
            {isAdmin && (
              <input type="checkbox" className="h-4 w-4 shrink-0"
                checked={allSelected} onChange={toggleAll}
                title={allSelected ? 'Deselect all on page' : 'Select all on page'} />
            )}
            <span className="w-24 shrink-0">Tag</span>
            <span className="flex-1">Name / Model</span>
            <span className="flex items-center gap-2">
              <span className="w-20 text-right">Source</span>
              <span className="w-20 text-right">Type</span>
              <span className="w-20 text-right">Status</span>
              <span className="w-36 text-right">Owner</span>
            </span>
          </div>

          {isLoading && <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>}
          {!isLoading && assets.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">No assets found.</div>}

          <div className="divide-y">
            {assets.map((asset: any) => (
              <div key={asset.id} className={`flex items-center gap-4 px-4 hover:bg-muted/50 transition-colors ${selected.has(asset.id) ? 'bg-primary/5' : ''}`}>
                {isAdmin && (
                  <input type="checkbox" className="h-4 w-4 shrink-0 cursor-pointer"
                    checked={selected.has(asset.id)}
                    onChange={() => toggleOne(asset.id)} />
                )}
                <Link to={`/assets/${asset.id}`} className="flex flex-1 items-center gap-4 py-4 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground w-24 shrink-0">{asset.assetTag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{asset.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[asset.manufacturer, asset.modelName].filter(Boolean).join(' ') || asset.type.replace('_', ' ')}
                      {asset.location && ` · ${asset.location}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {asset.externalSource && SOURCE_COLOURS[asset.externalSource] && (
                      <span className={`hidden sm:inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${SOURCE_COLOURS[asset.externalSource]}`}>
                        {SOURCE_LABELS[asset.externalSource] ?? asset.externalSource}
                      </span>
                    )}
                    <Badge variant="outline">{asset.type.replace('_', ' ')}</Badge>
                    <Badge variant={(statusVariant[asset.status] as 'default') ?? 'secondary'}>
                      {asset.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground w-36 truncate hidden lg:block text-right">
                      {asset.assignedTo?.email ?? asset.assignedContact?.email ?? (asset.customFields?.assignedUserEmail as string) ?? '—'}
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <span>{meta.total} total</span>
          </div>
          {meta.totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              {getPageNumbers(page, meta.totalPages).map((p, i) =>
                p === '...'
                  ? <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
                  : <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm" className="w-9" onClick={() => setPage(p)}>{p}</Button>
              )}
              <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
