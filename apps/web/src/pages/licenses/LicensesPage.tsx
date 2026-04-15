import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, KeyRound, AlertTriangle, CheckCircle, XCircle, Clock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getLicenses, createLicense, updateLicense, deleteLicense, type License } from '@/api/licenses';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  subscription: 'Subscription',
  perpetual:    'Perpetual',
  oem:          'OEM',
  volume:       'Volume',
  freeware:     'Freeware',
  open_source:  'Open Source',
};

const CYCLE_LABELS: Record<string, string> = {
  monthly:  'Monthly',
  annually: 'Annually',
  one_time: 'One-time',
};

const STATUS_CONFIG = {
  active:         { label: 'Active',          icon: CheckCircle,  colour: 'text-green-600',           variant: 'success' as const },
  expiring_soon:  { label: 'Expiring Soon',   icon: AlertTriangle, colour: 'text-amber-600',          variant: 'warning' as const },
  expired:        { label: 'Expired',         icon: XCircle,      colour: 'text-red-600',             variant: 'destructive' as const },
  no_expiry:      { label: 'No expiry',       icon: Clock,        colour: 'text-muted-foreground',    variant: 'secondary' as const },
};

function daysUntil(renewalDate: string | undefined): number | null {
  if (!renewalDate) return null;
  return Math.ceil((new Date(renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function DaysLabel({ renewalDate }: { renewalDate?: string }) {
  const days = daysUntil(renewalDate);
  if (days === null) return <span className="text-muted-foreground text-xs">—</span>;
  if (days <= 0) return <span className="text-xs font-semibold text-red-600">Expired</span>;
  const colour = days <= 14 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : days <= 90 ? 'text-blue-600' : 'text-green-600';
  return <span className={`text-xs font-semibold ${colour}`}>{days}d</span>;
}

// ── License form modal ────────────────────────────────────────────────────────

function LicenseModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: License }) {
  const queryClient = useQueryClient();
  const [name,         setName]         = useState(editing?.name ?? '');
  const [vendor,       setVendor]       = useState(editing?.vendor ?? '');
  const [licenseType,  setLicenseType]  = useState(editing?.licenseType ?? 'subscription');
  const [seats,        setSeats]        = useState(editing?.seats !== undefined ? String(editing.seats) : '');
  const [cost,         setCost]         = useState(editing?.cost !== undefined ? String(editing.cost) : '');
  const [billingCycle, setBillingCycle] = useState(editing?.billingCycle ?? '');
  const [purchasedAt,  setPurchasedAt]  = useState(editing?.purchasedAt ? editing.purchasedAt.slice(0, 10) : '');
  const [renewalDate,  setRenewalDate]  = useState(editing?.renewalDate ? editing.renewalDate.slice(0, 10) : '');
  const [licenseKey,   setLicenseKey]   = useState(editing?.licenseKey ?? '');
  const [showKey,      setShowKey]      = useState(false);
  const [assignedTo,   setAssignedTo]   = useState(editing?.assignedTo ?? '');
  const [notes,        setNotes]        = useState(editing?.notes ?? '');
  const [tags,         setTags]         = useState(editing?.tags?.join(', ') ?? '');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = {
        name:         name.trim(),
        vendor:       vendor.trim() || undefined,
        licenseType:  licenseType as License['licenseType'],
        seats:        seats ? Number(seats) : undefined,
        cost:         cost ? Number(cost) : undefined,
        billingCycle: (billingCycle || undefined) as License['billingCycle'],
        purchasedAt:  purchasedAt ? new Date(purchasedAt).toISOString() : undefined,
        renewalDate:  renewalDate ? new Date(renewalDate).toISOString() : undefined,
        licenseKey:   licenseKey.trim() || undefined,
        assignedTo:   assignedTo.trim() || undefined,
        notes:        notes.trim() || undefined,
        tags:         tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      };
      return editing ? updateLicense(editing.id, payload) : createLicense(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit License' : 'Add License'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Software name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Microsoft 365 Business Premium" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Input placeholder="e.g. Microsoft" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>License type</Label>
              <Select value={licenseType} onValueChange={(v) => setLicenseType(v as License['licenseType'])}>

                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Seats</Label>
              <Input type="number" placeholder="25" value={seats} onChange={(e) => setSeats(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost (£)</Label>
              <Input type="number" placeholder="0.00" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Billing</Label>
              <Select value={billingCycle || '__none__'} onValueChange={(v) => setBillingCycle(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {Object.entries(CYCLE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Purchase date</Label>
              <Input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Renewal date</Label>
              <Input type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>License key</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? 'text' : 'password'}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                className="font-mono text-sm"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(!showKey)} className="shrink-0">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assigned to</Label>
            <Input placeholder="e.g. All staff, Finance team, IT dept" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Input placeholder="e.g. microsoft, productivity, security" value={tags} onChange={(e) => setTags(e.target.value)} />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Renewal contacts, account numbers, portal URLs…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {error && (
            <p className="text-sm text-destructive">{(error as any)?.response?.data?.error ?? 'An error occurred'}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !name.trim()}>
            {isPending ? (editing ? 'Saving…' : 'Adding…') : (editing ? 'Save' : 'Add license')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Key reveal cell ───────────────────────────────────────────────────────────

function LicenseKeyCell({ licenseKey }: { licenseKey?: string }) {
  const [visible, setVisible] = useState(false);
  if (!licenseKey) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-mono">{visible ? licenseKey : '••••••••••••'}</span>
      <button type="button" onClick={() => setVisible(!visible)} className="text-muted-foreground hover:text-foreground">
        {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LicensesPage() {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen]   = useState(false);
  const [editing,   setEditing]     = useState<License | undefined>();
  const [search,    setSearch]      = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType,   setFilterType]   = useState('');

  const { data: licenses = [], isLoading } = useQuery({
    queryKey: ['licenses', { search, filterStatus, filterType }],
    queryFn: () => getLicenses({
      search:      search || undefined,
      status:      filterStatus || undefined,
      licenseType: filterType || undefined,
    }),
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteLicense,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['licenses'] }),
  });

  function openAdd() { setEditing(undefined); setModalOpen(true); }
  function openEdit(lic: License) { setEditing(lic); setModalOpen(true); }

  // Summary counts (from unfiltered data — re-query without filters for counts)
  const { data: allLicenses = [] } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => getLicenses(),
  });

  const countActive       = allLicenses.filter((l) => l.status === 'active').length;
  const countExpiring     = allLicenses.filter((l) => l.status === 'expiring_soon').length;
  const countExpired      = allLicenses.filter((l) => l.status === 'expired').length;
  const totalMonthlyCost  = allLicenses.filter((l) => l.billingCycle === 'monthly' && l.cost).reduce((s, l) => s + (l.cost ?? 0), 0);
  const totalAnnualCost   = allLicenses.filter((l) => l.billingCycle === 'annually' && l.cost).reduce((s, l) => s + (l.cost ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Software Licenses</h1>
          <p className="text-sm text-muted-foreground">
            {allLicenses.length} license{allLicenses.length !== 1 ? 's' : ''} tracked
            {countExpired  > 0 && <span className="text-red-600 font-medium"> · {countExpired} expired</span>}
            {countExpiring > 0 && <span className="text-amber-600 font-medium"> · {countExpiring} expiring soon</span>}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add License
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {allLicenses.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <p className="text-2xl font-bold text-green-600">{countActive}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <p className="text-2xl font-bold text-amber-600">{countExpiring}</p>
              <p className="text-xs text-muted-foreground">Expiring ≤90d</p>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <p className="text-2xl font-bold text-red-600">{countExpired}</p>
              <p className="text-xs text-muted-foreground">Expired</p>
            </CardContent>
          </Card>
          <Card className="py-3">
            <CardContent className="px-4 py-0">
              <p className="text-2xl font-bold">
                {totalAnnualCost > 0
                  ? `£${totalAnnualCost.toLocaleString()}`
                  : totalMonthlyCost > 0
                  ? `£${totalMonthlyCost.toLocaleString()}`
                  : '—'}
              </p>
              <p className="text-xs text-muted-foreground">
                {totalAnnualCost > 0 ? 'Annual subscriptions' : totalMonthlyCost > 0 ? 'Monthly subscriptions' : 'Cost tracked'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search name, vendor, assigned to…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 w-64"
        />
        <Select value={filterStatus || '__all__'} onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expiring_soon">Expiring soon</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="no_expiry">No expiry</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType || '__all__'} onValueChange={(v) => setFilterType(v === '__all__' ? '' : v)}>
          <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Column headers */}
          <div className="hidden lg:flex items-center gap-4 px-4 py-2 border-b text-xs text-muted-foreground">
            <span className="w-5 shrink-0"></span>
            <span className="flex-1 min-w-0">Software / Vendor</span>
            <span className="w-24 shrink-0">Type</span>
            <span className="w-16 text-right shrink-0">Seats</span>
            <span className="w-28 text-right shrink-0">Cost</span>
            <span className="w-28 text-right shrink-0">Renewal</span>
            <span className="w-12 text-right shrink-0">Days</span>
            <span className="w-28 shrink-0">License key</span>
            <span className="w-24 text-right shrink-0">Status</span>
            {isAdmin && <span className="w-16 shrink-0"></span>}
          </div>

          {isLoading && <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>}

          {!isLoading && licenses.length === 0 && (
            <div className="p-12 text-center">
              <KeyRound className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search || filterStatus || filterType ? 'No licenses match your filters.' : 'No licenses tracked yet.'}
              </p>
              {isAdmin && !search && !filterStatus && !filterType && (
                <Button variant="outline" className="mt-3" onClick={openAdd}>
                  <Plus className="w-4 h-4" /> Add your first license
                </Button>
              )}
            </div>
          )}

          <div className="divide-y">
            {licenses.map((lic) => {
              const cfg = STATUS_CONFIG[lic.status];
              const StatusIcon = cfg.icon;

              return (
                <div key={lic.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <StatusIcon className={`w-4 h-4 shrink-0 ${cfg.colour}`} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{lic.name}</p>
                    {lic.vendor && <p className="text-xs text-muted-foreground truncate">{lic.vendor}</p>}
                    {lic.assignedTo && <p className="text-xs text-muted-foreground truncate">{lic.assignedTo}</p>}
                  </div>

                  <div className="w-24 shrink-0">
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[lic.licenseType]}</Badge>
                  </div>

                  <div className="w-16 text-right shrink-0 text-sm text-muted-foreground">
                    {lic.seats !== undefined ? lic.seats : '—'}
                  </div>

                  <div className="w-28 text-right shrink-0">
                    {lic.cost !== undefined ? (
                      <span className="text-sm">
                        £{lic.cost.toLocaleString()}
                        {lic.billingCycle && <span className="text-xs text-muted-foreground">/{lic.billingCycle === 'monthly' ? 'mo' : lic.billingCycle === 'annually' ? 'yr' : ''}</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </div>

                  <div className="w-28 text-right shrink-0 text-xs text-muted-foreground">
                    {lic.renewalDate ? new Date(lic.renewalDate).toLocaleDateString() : '—'}
                  </div>

                  <div className="w-12 text-right shrink-0">
                    <DaysLabel renewalDate={lic.renewalDate} />
                  </div>

                  <div className="w-28 shrink-0">
                    <LicenseKeyCell licenseKey={lic.licenseKey} />
                  </div>

                  <div className="w-24 shrink-0 text-right">
                    <Badge variant={(cfg.variant as any) ?? 'secondary'}>{cfg.label}</Badge>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 w-16 justify-end shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(lic)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Delete license "${lic.name}"?`)) doDelete(lic.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <LicenseModal key={editing?.id ?? 'new'} open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
