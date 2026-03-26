import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Globe, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getNetworks, createNetwork, updateNetwork, deleteNetwork } from '@/api/networks';
import { getLocations } from '@/api/locations';
import { getAssets } from '@/api/assets';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole, type NetworkResponse, type LocationResponse } from '@itdesk/shared';

// ── Network modal ─────────────────────────────────────────────────────────────

function NetworkModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: NetworkResponse }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [vlanId, setVlanId] = useState(editing?.vlanId?.toString() ?? '');
  const [gateway, setGateway] = useState(editing?.gateway ?? '');
  const [dns, setDns] = useState(editing?.dnsServers?.join(', ') ?? '');
  const [dhcpEnabled, setDhcpEnabled] = useState(editing?.dhcpEnabled ?? false);
  const [dhcpRange, setDhcpRange] = useState(editing?.dhcpRange ?? '');
  const [locationId, setLocationId] = useState((editing?.location as any)?.id ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');

  const { data: locations = [] } = useQuery<LocationResponse[]>({
    queryKey: ['locations'],
    queryFn: () => getLocations(),
  });

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = {
        name, address,
        vlanId: vlanId ? parseInt(vlanId) : undefined,
        gateway: gateway || undefined,
        dnsServers: dns ? dns.split(',').map((s) => s.trim()).filter(Boolean) : [],
        dhcpEnabled,
        dhcpRange: dhcpRange || undefined,
        locationId: locationId || undefined,
        description: description || undefined,
        notes: notes || undefined,
      };
      return editing ? updateNetwork(editing.id, payload) : createNetwork(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Network' : 'New Network'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Corporate LAN" />
            </div>
            <div className="space-y-1.5">
              <Label>Network Address (CIDR) *</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 192.168.1.0/24" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>VLAN ID</Label>
              <Input type="number" min={1} max={4094} value={vlanId} onChange={(e) => setVlanId(e.target.value)} placeholder="e.g. 10" />
            </div>
            <div className="space-y-1.5">
              <Label>Gateway</Label>
              <Input value={gateway} onChange={(e) => setGateway(e.target.value)} placeholder="e.g. 192.168.1.1" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>DNS Servers</Label>
              <Input value={dns} onChange={(e) => setDns(e.target.value)} placeholder="8.8.8.8, 8.8.4.4" className="font-mono text-sm" />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>
          </div>

          <div className="flex items-center gap-3 border rounded-md p-3">
            <input
              type="checkbox"
              id="dhcp"
              checked={dhcpEnabled}
              onChange={(e) => setDhcpEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            <Label htmlFor="dhcp" className="cursor-pointer">DHCP Enabled</Label>
          </div>

          {dhcpEnabled && (
            <div className="space-y-1.5">
              <Label>DHCP Range</Label>
              <Input value={dhcpRange} onChange={(e) => setDhcpRange(e.target.value)} placeholder="e.g. 192.168.1.100 - 192.168.1.200" className="font-mono text-sm" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Location</Label>
            <Select value={locationId || '__none__'} onValueChange={(v) => setLocationId(v === '__none__' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No location</SelectItem>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes, reserved IPs, etc." />
          </div>
        </div>

        {error && <p className="text-xs text-destructive mt-2">{(error as any)?.response?.data?.message ?? 'Failed to save'}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={!name.trim() || !address.trim() || isPending}>
            {isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Network card ──────────────────────────────────────────────────────────────

function NetworkCard({ network, isAdmin, onEdit, onDelete }: {
  network: NetworkResponse;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: assetsData } = useQuery({
    queryKey: ['assets', 'by-network', network.id],
    queryFn: () => getAssets({ networkId: network.id, limit: 50 }),
    enabled: expanded,
  });
  const linkedAssets: any[] = assetsData?.data ?? [];

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-0">
        {/* Main row */}
        <div
          className="flex items-center gap-4 px-4 py-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{network.name}</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{network.address}</code>
              {network.vlanId && <Badge variant="outline" className="text-xs">VLAN {network.vlanId}</Badge>}
              {network.dhcpEnabled && <Badge variant="secondary" className="text-xs">DHCP</Badge>}
              {network.location && <Badge variant="outline" className="text-xs">{(network.location as any).name}</Badge>}
              {(network as any).externalSource === 'meraki' && <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">Meraki</Badge>}
            </div>
            {network.description && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{network.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm bg-muted/30">
            {network.gateway && (
              <div>
                <p className="text-xs text-muted-foreground">Gateway</p>
                <code className="font-mono text-sm">{network.gateway}</code>
              </div>
            )}
            {network.dnsServers?.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground">DNS</p>
                <code className="font-mono text-sm">{network.dnsServers.join(', ')}</code>
              </div>
            )}
            {network.dhcpEnabled && network.dhcpRange && (
              <div>
                <p className="text-xs text-muted-foreground">DHCP Range</p>
                <code className="font-mono text-sm">{network.dhcpRange}</code>
              </div>
            )}
            {network.notes && (
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{network.notes}</p>
              </div>
            )}
            {linkedAssets.length > 0 && (
              <div className="col-span-2 sm:col-span-3 border-t pt-3 mt-1">
                <p className="text-xs text-muted-foreground mb-2">Devices on this network ({linkedAssets.length})</p>
                <div className="flex flex-wrap gap-2">
                  {linkedAssets.map((a: any) => (
                    <Link key={a.id} to={`/assets/${a.id}`}>
                      <div className="flex items-center gap-1.5 text-xs border rounded px-2 py-1 hover:border-primary bg-background transition-colors">
                        <span className="font-mono text-muted-foreground">{a.assetTag}</span>
                        <span className="font-medium">{a.name}</span>
                        <span className="text-muted-foreground capitalize">{a.type?.replace(/_/g, ' ')}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {expanded && linkedAssets.length === 0 && assetsData && (
              <div className="col-span-2 sm:col-span-3 border-t pt-3 mt-1">
                <p className="text-xs text-muted-foreground">No devices assigned to this network.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function NetworksPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<NetworkResponse | undefined>();
  const [search, setSearch] = useState('');

  const { data: networks = [] } = useQuery<NetworkResponse[]>({
    queryKey: ['networks'],
    queryFn: () => getNetworks(),
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteNetwork,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['networks'] }),
  });

  const filtered = networks.filter((n) =>
    !search ||
    n.name.toLowerCase().includes(search.toLowerCase()) ||
    n.address.includes(search) ||
    n.vlanId?.toString().includes(search),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Networks</h1>
          <p className="text-sm text-muted-foreground mt-0.5">IP ranges, VLANs and subnets</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(undefined); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> New Network
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, IP, or VLAN…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {search ? 'No networks match your search.' : 'No networks documented yet.'}
            {isAdmin && !search && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setModalOpen(true); }}>
                  Add your first network
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <NetworkCard
              key={n.id}
              network={n}
              isAdmin={isAdmin}
              onEdit={() => { setEditing(n); setModalOpen(true); }}
              onDelete={() => { if (confirm(`Delete network "${n.name}"?`)) doDelete(n.id); }}
            />
          ))}
        </div>
      )}

      <NetworkModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        editing={editing}
      />
    </div>
  );
}
