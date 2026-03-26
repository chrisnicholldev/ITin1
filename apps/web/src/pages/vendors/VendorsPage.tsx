import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Phone, Mail, Globe, UserPlus, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole, VendorType, type VendorResponse } from '@itdesk/shared';
import {
  getVendors, createVendor, updateVendor, deleteVendor,
  addContact, updateContact, deleteContact,
} from '@/api/vendors';

const TYPE_COLOURS: Record<string, string> = {
  isp: 'bg-blue-100 text-blue-800',
  hardware: 'bg-orange-100 text-orange-800',
  software: 'bg-purple-100 text-purple-800',
  msp: 'bg-green-100 text-green-800',
  telecoms: 'bg-cyan-100 text-cyan-800',
  cloud: 'bg-sky-100 text-sky-800',
  facilities: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-700',
};

// ── Vendor modal ──────────────────────────────────────────────────────────────

function VendorModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: VendorResponse }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name ?? '');
  const [type, setType] = useState(editing?.type ?? '');
  const [website, setWebsite] = useState(editing?.website ?? '');
  const [supportPhone, setSupportPhone] = useState(editing?.supportPhone ?? '');
  const [supportEmail, setSupportEmail] = useState(editing?.supportEmail ?? '');
  const [accountNumber, setAccountNumber] = useState(editing?.accountNumber ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = {
        name, type,
        website: website || undefined,
        supportPhone: supportPhone || undefined,
        supportEmail: supportEmail || undefined,
        accountNumber: accountNumber || undefined,
        notes: notes || undefined,
      };
      return editing ? updateVendor(editing.id, payload) : createVendor(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Vendor' : 'New Vendor'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BT Business" />
            </div>
            <div className="space-y-1.5">
              <Label>Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VendorType).map(([, v]) => (
                    <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account / Reference No.</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="e.g. ACC-12345" />
            </div>
            <div className="space-y-1.5">
              <Label>Support Phone</Label>
              <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="e.g. 0800 000 000" />
            </div>
            <div className="space-y-1.5">
              <Label>Support Email</Label>
              <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="support@vendor.com" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://vendor.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Account details, SLA notes, escalation procedures…" />
          </div>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{(error as any)?.response?.data?.message ?? 'Failed to save'}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={!name.trim() || !type || isPending}>
            {isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Contact modal ─────────────────────────────────────────────────────────────

type ContactFormData = { name: string; title: string; phone: string; email: string; notes: string; isPrimary: boolean };

function ContactModal({ open, onClose, vendorId, editing }: {
  open: boolean; onClose: () => void; vendorId: string;
  editing?: VendorResponse['contacts'][0];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContactFormData>({
    name: editing?.name ?? '',
    title: editing?.title ?? '',
    phone: editing?.phone ?? '',
    email: editing?.email ?? '',
    notes: editing?.notes ?? '',
    isPrimary: editing?.isPrimary ?? false,
  });

  const set = (k: keyof ContactFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        title: form.title || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        notes: form.notes || undefined,
        isPrimary: form.isPrimary,
      };
      return editing
        ? updateContact(vendorId, editing.id, payload)
        : addContact(vendorId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={set('name')} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label>Role / Title</Label>
              <Input value={form.title} onChange={set('title')} placeholder="e.g. Account Manager" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={set('phone')} placeholder="e.g. 07700 000000" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Email</Label>
              <Input value={form.email} onChange={set('email')} placeholder="name@vendor.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Best time to call, direct line, etc." />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="primary" className="h-4 w-4"
              checked={form.isPrimary} onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))} />
            <Label htmlFor="primary" className="cursor-pointer font-normal">Primary contact for this vendor</Label>
          </div>
        </div>
        {error && <p className="text-xs text-destructive mt-2">{(error as any)?.response?.data?.message ?? 'Failed to save'}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={!form.name.trim() || isPending}>
            {isPending ? 'Saving…' : editing ? 'Save' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Vendor card ───────────────────────────────────────────────────────────────

function VendorCard({ vendor, isAdmin, onEdit, onDelete }: {
  vendor: VendorResponse; isAdmin: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [contactModal, setContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<VendorResponse['contacts'][0] | undefined>();

  const { mutate: doDeleteContact } = useMutation({
    mutationFn: (contactId: string) => deleteContact(vendor.id, contactId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });

  const primaryContact = vendor.contacts.find((c) => c.isPrimary) ?? vendor.contacts[0];

  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-0">
        {/* Main row */}
        <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{vendor.name}</span>
              <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${TYPE_COLOURS[vendor.type] ?? TYPE_COLOURS.other}`}>
                {vendor.type}
              </span>
              {vendor.contacts.length > 0 && (
                <Badge variant="secondary" className="text-xs">{vendor.contacts.length} contact{vendor.contacts.length !== 1 ? 's' : ''}</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {vendor.supportPhone && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />{vendor.supportPhone}
                </span>
              )}
              {vendor.supportEmail && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />{vendor.supportEmail}
                </span>
              )}
              {primaryContact && !vendor.supportPhone && !vendor.supportEmail && (
                <span className="text-xs text-muted-foreground">Contact: {primaryContact.name}{primaryContact.title ? ` · ${primaryContact.title}` : ''}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-destructive" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t px-4 py-3 bg-muted/30 space-y-4">
            {/* Vendor info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              {vendor.accountNumber && (
                <div><p className="text-xs text-muted-foreground">Account No.</p><p className="font-mono text-sm">{vendor.accountNumber}</p></div>
              )}
              {vendor.website && (
                <div>
                  <p className="text-xs text-muted-foreground">Website</p>
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Globe className="h-3 w-3" />{vendor.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {vendor.supportPhone && (
                <div><p className="text-xs text-muted-foreground">Support Phone</p><p className="font-mono text-sm">{vendor.supportPhone}</p></div>
              )}
              {vendor.supportEmail && (
                <div><p className="text-xs text-muted-foreground">Support Email</p><p className="text-sm">{vendor.supportEmail}</p></div>
              )}
              {vendor.notes && (
                <div className="col-span-2 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{vendor.notes}</p>
                </div>
              )}
            </div>

            {/* Contacts */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contacts</p>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={() => { setEditingContact(undefined); setContactModal(true); }}>
                    <UserPlus className="h-3.5 w-3.5" /> Add Contact
                  </Button>
                )}
              </div>
              {vendor.contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No contacts added yet.</p>
              ) : (
                <div className="space-y-2">
                  {vendor.contacts.map((contact) => (
                    <div key={contact.id} className="flex items-start justify-between gap-3 bg-background border rounded-md px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{contact.name}</span>
                          {contact.isPrimary && <Badge variant="secondary" className="text-xs">Primary</Badge>}
                          {contact.title && <span className="text-xs text-muted-foreground">{contact.title}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                              <Phone className="h-3 w-3" />{contact.phone}
                            </a>
                          )}
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                              <Mail className="h-3 w-3" />{contact.email}
                            </a>
                          )}
                        </div>
                        {contact.notes && <p className="text-xs text-muted-foreground mt-0.5">{contact.notes}</p>}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                            onClick={() => { setEditingContact(contact); setContactModal(true); }}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:text-destructive"
                            onClick={() => { if (confirm(`Remove ${contact.name}?`)) doDeleteContact(contact.id); }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {contactModal && (
        <ContactModal
          open={contactModal}
          onClose={() => { setContactModal(false); setEditingContact(undefined); }}
          vendorId={vendor.id}
          editing={editingContact}
        />
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function VendorsPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VendorResponse | undefined>();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { data: vendors = [] } = useQuery<VendorResponse[]>({
    queryKey: ['vendors'],
    queryFn: getVendors,
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteVendor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
  });

  const filtered = vendors.filter((v) => {
    const matchesSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      v.supportPhone?.includes(search) ||
      v.supportEmail?.toLowerCase().includes(search.toLowerCase()) ||
      v.contacts.some((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    const matchesType = !typeFilter || v.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Vendors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Third-party suppliers, ISPs, and service contacts</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(undefined); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> New Vendor
          </Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Input placeholder="Search vendors or contacts…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(VendorType).map(([, v]) => (
              <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {search || typeFilter ? 'No vendors match your search.' : 'No vendors added yet.'}
            {isAdmin && !search && !typeFilter && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setModalOpen(true); }}>
                  Add your first vendor
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => (
            <VendorCard
              key={v.id}
              vendor={v}
              isAdmin={isAdmin}
              onEdit={() => { setEditing(v); setModalOpen(true); }}
              onDelete={() => { if (confirm(`Delete vendor "${v.name}"?`)) doDelete(v.id); }}
            />
          ))}
        </div>
      )}

      <VendorModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        editing={editing}
      />
    </div>
  );
}
