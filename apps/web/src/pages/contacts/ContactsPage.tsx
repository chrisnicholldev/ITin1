import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Phone, Mail, Building2, Search, User, Cloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';
import {
  getContacts, createContact, updateContact, deleteContact,
  type Contact, type CreateContactInput,
} from '@/api/contacts';

// ── Modal ─────────────────────────────────────────────────────────────────────

function ContactModal({ open, onClose, editing }: {
  open: boolean;
  onClose: () => void;
  editing?: Contact;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateContactInput>({
    displayName: editing?.displayName ?? '',
    email: editing?.email ?? '',
    phone: editing?.phone ?? '',
    company: editing?.company ?? '',
    jobTitle: editing?.jobTitle ?? '',
    department: editing?.department ?? '',
    notes: editing?.notes ?? '',
  });

  const set = (k: keyof CreateContactInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload: CreateContactInput = {
        displayName: form.displayName,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        jobTitle: form.jobTitle || undefined,
        department: form.department || undefined,
        notes: form.notes || undefined,
      };
      return editing ? updateContact(editing.id, payload) : createContact(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Contact' : 'New Contact'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={form.displayName} onChange={set('displayName')} placeholder="Full name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={set('phone')} placeholder="e.g. 07700 000000" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={form.email} onChange={set('email')} placeholder="name@example.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input value={form.company} onChange={set('company')} placeholder="e.g. Acme Ltd" />
            </div>
            <div className="space-y-1.5">
              <Label>Job Title</Label>
              <Input value={form.jobTitle} onChange={set('jobTitle')} placeholder="e.g. IT Manager" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={set('department')} placeholder="e.g. IT, Finance" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={3} value={form.notes} onChange={set('notes')}
              placeholder="Best time to call, escalation path, etc." />
          </div>
        </div>
        {error && (
          <p className="text-xs text-destructive mt-2">
            {(error as any)?.response?.data?.error ?? 'Failed to save contact'}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={!form.displayName.trim() || isPending}>
            {isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ContactsPage() {
  const user = useAuthStore((s) => s.user);
  const isTech = user?.role !== UserRole.END_USER;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | undefined>();

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts', search],
    queryFn: () => getContacts(search || undefined),
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  });

  const azureContacts = contacts.filter((c) => c.source === 'azure_ad');
  const manualContacts = contacts.filter((c) => c.source === 'manual');

  function ContactRow({ contact }: { contact: Contact }) {
    const isManual = contact.source === 'manual';
    return (
      <div className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold">{contact.displayName.slice(0, 2).toUpperCase()}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{contact.displayName}</span>
            {contact.source === 'azure_ad' ? (
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <Cloud className="h-2.5 w-2.5" /> Azure AD
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <User className="h-2.5 w-2.5" /> Manual
              </Badge>
            )}
            {contact.source === 'azure_ad' && contact.accountEnabled === false && (
              <Badge variant="destructive" className="text-xs">Disabled</Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {contact.jobTitle && (
              <span className="text-xs text-muted-foreground">{contact.jobTitle}</span>
            )}
            {contact.company && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" />{contact.company}
              </span>
            )}
            {contact.department && !contact.company && (
              <span className="text-xs text-muted-foreground">{contact.department}</span>
            )}
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
          {contact.notes && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{contact.notes}</p>
          )}
        </div>
        {isTech && isManual && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => { setEditing(contact); setModalOpen(true); }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-destructive"
              onClick={() => { if (confirm(`Delete "${contact.displayName}"?`)) doDelete(contact.id); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manual contacts and Azure AD users
          </p>
        </div>
        {isTech && (
          <Button onClick={() => { setEditing(undefined); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> New Contact
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, email, company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground text-sm">Loading…</CardContent></Card>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            {search ? 'No contacts match your search.' : 'No contacts yet.'}
            {isTech && !search && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setModalOpen(true); }}>
                  Add your first contact
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {manualContacts.length > 0 && (
            <Card>
              <div className="px-4 py-2 border-b bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Manual Contacts ({manualContacts.length})
                </p>
              </div>
              <CardContent className="p-0 divide-y">
                {manualContacts.map((c) => <ContactRow key={c.id} contact={c} />)}
              </CardContent>
            </Card>
          )}

          {azureContacts.length > 0 && (
            <Card>
              <div className="px-4 py-2 border-b bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Cloud className="h-3.5 w-3.5" /> Azure AD ({azureContacts.length})
                </p>
              </div>
              <CardContent className="p-0 divide-y">
                {azureContacts.map((c) => <ContactRow key={c.id} contact={c} />)}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {modalOpen && (
        <ContactModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditing(undefined); }}
          editing={editing}
        />
      )}
    </div>
  );
}
