import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, FileText, AlertTriangle, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getContracts, createContract, updateContract, deleteContract, type Contract } from '@/api/contracts';
import { getVendors } from '@/api/vendors';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  vendor_contract: 'Vendor contract',
  warranty:        'Warranty',
  maintenance:     'Maintenance',
  support:         'Support',
  insurance:       'Insurance',
  lease:           'Lease',
  other:           'Other',
};

const STATUS_CONFIG = {
  active:        { label: 'Active',         icon: CheckCircle,   colour: 'text-green-600',        variant: 'success' as const },
  expiring_soon: { label: 'Expiring Soon',  icon: AlertTriangle, colour: 'text-amber-600',         variant: 'warning' as const },
  expired:       { label: 'Expired',        icon: XCircle,       colour: 'text-red-600',           variant: 'destructive' as const },
  no_expiry:     { label: 'No expiry',      icon: Clock,         colour: 'text-muted-foreground',  variant: 'secondary' as const },
};

function daysUntil(date: string | undefined) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function DaysLabel({ endDate }: { endDate?: string }) {
  const days = daysUntil(endDate);
  if (days === null) return <span className="text-muted-foreground text-xs">—</span>;
  if (days <= 0) return <span className="text-xs font-semibold text-red-600">Expired</span>;
  const colour = days <= 14 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : days <= 90 ? 'text-blue-600' : 'text-green-600';
  return <span className={`text-xs font-semibold ${colour}`}>{days}d</span>;
}

// ── Contract form modal ───────────────────────────────────────────────────────

function ContractModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: Contract }) {
  const queryClient = useQueryClient();

  const [name,             setName]             = useState(editing?.name ?? '');
  const [contractType,     setContractType]     = useState(editing?.contractType ?? 'vendor_contract');
  const [vendorId,         setVendorId]         = useState(editing?.vendor?.id ?? '');
  const [vendorName,       setVendorName]       = useState(editing?.vendorName ?? '');
  const [contractNumber,   setContractNumber]   = useState(editing?.contractNumber ?? '');
  const [value,            setValue]            = useState(editing?.value !== undefined ? String(editing.value) : '');
  const [startDate,        setStartDate]        = useState(editing?.startDate ? editing.startDate.slice(0, 10) : '');
  const [endDate,          setEndDate]          = useState(editing?.endDate ? editing.endDate.slice(0, 10) : '');
  const [autoRenews,       setAutoRenews]       = useState(editing?.autoRenews ?? false);
  const [noticePeriodDays, setNoticePeriodDays] = useState(editing?.noticePeriodDays !== undefined ? String(editing.noticePeriodDays) : '');
  const [contactName,      setContactName]      = useState(editing?.contactName ?? '');
  const [contactEmail,     setContactEmail]     = useState(editing?.contactEmail ?? '');
  const [documentUrl,      setDocumentUrl]      = useState(editing?.documentUrl ?? '');
  const [notes,            setNotes]            = useState(editing?.notes ?? '');
  const [tags,             setTags]             = useState(editing?.tags?.join(', ') ?? '');

  const { data: vendors = [] } = useQuery({ queryKey: ['vendors'], queryFn: getVendors });

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = {
        name:             name.trim(),
        contractType:     contractType as Contract['contractType'],
        vendorId:         vendorId || undefined,
        vendorName:       vendorName.trim() || undefined,
        contractNumber:   contractNumber.trim() || undefined,
        value:            value ? Number(value) : undefined,
        startDate:        startDate ? new Date(startDate).toISOString() : undefined,
        endDate:          endDate ? new Date(endDate).toISOString() : undefined,
        autoRenews,
        noticePeriodDays: noticePeriodDays ? Number(noticePeriodDays) : undefined,
        contactName:      contactName.trim() || undefined,
        contactEmail:     contactEmail.trim() || undefined,
        documentUrl:      documentUrl.trim() || undefined,
        notes:            notes.trim() || undefined,
        tags:             tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
      };
      return editing ? updateContract(editing.id, payload) : createContract(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Contract' : 'Add Contract'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Contract name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Office 365 Support Agreement" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={contractType} onValueChange={(v) => setContractType(v as Contract['contractType'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Contract / ref number</Label>
              <Input placeholder="REF-12345" value={contractNumber} onChange={(e) => setContractNumber(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Vendor (from records)</Label>
              <Select value={vendorId || '__none__'} onValueChange={(v) => setVendorId(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Select vendor…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vendor name (free text)</Label>
              <Input placeholder="If not in vendor list" value={vendorName} onChange={(e) => setVendorName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End / renewal date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Value (£)</Label>
              <Input type="number" placeholder="0.00" value={value} onChange={(e) => setValue(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notice period (days)</Label>
              <Input type="number" placeholder="30" value={noticePeriodDays} onChange={(e) => setNoticePeriodDays(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoRenews"
              checked={autoRenews}
              onChange={(e) => setAutoRenews(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="autoRenews" className="cursor-pointer">Auto-renews</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Renewal contact name</Label>
              <Input placeholder="Jane Smith" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Renewal contact email</Label>
              <Input type="email" placeholder="jane@vendor.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Document URL</Label>
            <Input placeholder="https://…" value={documentUrl} onChange={(e) => setDocumentUrl(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Input placeholder="e.g. microsoft, support, annual" value={tags} onChange={(e) => setTags(e.target.value)} />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea placeholder="Account numbers, terms, escalation contacts…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>

          {error && (
            <p className="text-sm text-destructive">{(error as any)?.response?.data?.error ?? 'An error occurred'}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !name.trim()}>
            {isPending ? (editing ? 'Saving…' : 'Adding…') : (editing ? 'Save' : 'Add contract')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ContractsPage() {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const queryClient = useQueryClient();

  const [modalOpen,     setModalOpen]     = useState(false);
  const [editing,       setEditing]       = useState<Contract | undefined>();
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterType,    setFilterType]    = useState('');

  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['contracts', { search, filterStatus, filterType }],
    queryFn: () => getContracts({ search: search || undefined, status: filterStatus || undefined, contractType: filterType || undefined }),
  });

  const { data: allContracts = [] } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => getContracts(),
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteContract,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  });

  function openAdd() { setEditing(undefined); setModalOpen(true); }
  function openEdit(c: Contract) { setEditing(c); setModalOpen(true); }

  const countActive   = allContracts.filter((c) => c.status === 'active').length;
  const countExpiring = allContracts.filter((c) => c.status === 'expiring_soon').length;
  const countExpired  = allContracts.filter((c) => c.status === 'expired').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contracts &amp; Warranties</h1>
          <p className="text-sm text-muted-foreground">
            {allContracts.length} contract{allContracts.length !== 1 ? 's' : ''} tracked
            {countExpired  > 0 && <span className="text-red-600 font-medium"> · {countExpired} expired</span>}
            {countExpiring > 0 && <span className="text-amber-600 font-medium"> · {countExpiring} expiring soon</span>}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Contract
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {allContracts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active',          count: countActive,   colour: 'text-green-600' },
            { label: 'Expiring ≤90d',   count: countExpiring, colour: 'text-amber-600' },
            { label: 'Expired',         count: countExpired,  colour: 'text-red-600'   },
            { label: 'No expiry',       count: allContracts.filter((c) => c.status === 'no_expiry').length, colour: 'text-muted-foreground' },
          ].map((s) => (
            <Card key={s.label} className="py-3">
              <CardContent className="px-4 py-0">
                <p className={`text-2xl font-bold ${s.colour}`}>{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search name, vendor, ref…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 w-64" />
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
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden lg:flex items-center gap-4 px-4 py-2 border-b text-xs text-muted-foreground">
            <span className="w-5 shrink-0"></span>
            <span className="flex-1 min-w-0">Contract / Vendor</span>
            <span className="w-28 shrink-0">Type</span>
            <span className="w-24 text-right shrink-0">Value</span>
            <span className="w-28 text-right shrink-0">End date</span>
            <span className="w-36 shrink-0">Notice deadline</span>
            <span className="w-12 text-right shrink-0">Days</span>
            <span className="w-24 text-right shrink-0">Status</span>
            {isAdmin && <span className="w-16 shrink-0"></span>}
          </div>

          {isLoading && <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>}

          {!isLoading && contracts.length === 0 && (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {search || filterStatus || filterType ? 'No contracts match your filters.' : 'No contracts tracked yet.'}
              </p>
              {isAdmin && !search && !filterStatus && !filterType && (
                <Button variant="outline" className="mt-3" onClick={openAdd}>
                  <Plus className="w-4 h-4" /> Add your first contract
                </Button>
              )}
            </div>
          )}

          <div className="divide-y">
            {contracts.map((c) => {
              const cfg = STATUS_CONFIG[c.status];
              const StatusIcon = cfg.icon;
              const vendorDisplay = c.vendor?.name ?? c.vendorName;

              return (
                <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <StatusIcon className={`w-4 h-4 shrink-0 ${cfg.colour}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      {c.documentUrl && (
                        <a href={c.documentUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    {vendorDisplay && <p className="text-xs text-muted-foreground truncate">{vendorDisplay}</p>}
                    {c.contractNumber && <p className="text-xs text-muted-foreground truncate">Ref: {c.contractNumber}</p>}
                    {c.autoRenews && <p className="text-xs text-blue-600">Auto-renews</p>}
                  </div>

                  <div className="w-28 shrink-0">
                    <Badge variant="outline" className="text-xs">{TYPE_LABELS[c.contractType]}</Badge>
                  </div>

                  <div className="w-24 text-right shrink-0 text-sm text-muted-foreground">
                    {c.value !== undefined ? `£${c.value.toLocaleString()}` : '—'}
                  </div>

                  <div className="w-28 text-right shrink-0 text-xs text-muted-foreground">
                    {c.endDate ? new Date(c.endDate).toLocaleDateString() : '—'}
                  </div>

                  <div className="w-36 shrink-0">
                    {c.noticeDueDate ? (
                      <span className={`text-xs ${daysUntil(c.noticeDueDate) !== null && daysUntil(c.noticeDueDate)! <= 0 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                        {new Date(c.noticeDueDate).toLocaleDateString()}
                        {c.noticePeriodDays && <span className="text-muted-foreground"> ({c.noticePeriodDays}d)</span>}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>

                  <div className="w-12 text-right shrink-0">
                    <DaysLabel endDate={c.endDate} />
                  </div>

                  <div className="w-24 text-right shrink-0">
                    <Badge variant={(cfg.variant as any) ?? 'secondary'}>{cfg.label}</Badge>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 w-16 justify-end shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => { if (confirm(`Delete contract "${c.name}"?`)) doDelete(c.id); }}
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

      <ContractModal key={editing?.id ?? 'new'} open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
