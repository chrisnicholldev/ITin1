import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus, Eye, EyeOff, Copy, Check, Pencil, Trash2, Shield, ChevronDown, ChevronUp, ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  listCredentials, createCredential, updateCredential, deleteCredential,
  revealPassword, copyPassword, getAuditLog,
} from '@/api/vault';
import { getAssets } from '@/api/assets';
import { CreateCredentialSchema, CredentialCategory, type CreateCredentialInput, type CredentialResponse } from '@itdesk/shared';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

const CATEGORY_LABELS: Record<string, string> = {
  service_account: 'Service Account',
  device: 'Device',
  shared_account: 'Shared Account',
  api_key: 'API Key',
  other: 'Other',
};

const CATEGORY_COLOURS: Record<string, string> = {
  service_account: 'bg-blue-100 text-blue-800',
  device: 'bg-green-100 text-green-800',
  shared_account: 'bg-purple-100 text-purple-800',
  api_key: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-700',
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Password reveal cell ──────────────────────────────────────────────────────

function PasswordCell({ id }: { id: string }) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReveal() {
    if (visible) { setVisible(false); return; }
    setLoading(true);
    try {
      const res = await revealPassword(id);
      setPassword(res.password);
      setVisible(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    setLoading(true);
    try {
      const res = await copyPassword(id);
      await navigator.clipboard.writeText(res.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm">
        {visible && password ? password : '••••••••'}
      </span>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleReveal} disabled={loading}>
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy} disabled={loading}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// ── Credential form modal ─────────────────────────────────────────────────────

function CredentialModal({
  open, onClose, editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: CredentialResponse;
}) {
  const queryClient = useQueryClient();
  const { data: assetsData } = useQuery({
    queryKey: ['assets', 'all'],
    queryFn: () => getAssets({ limit: 200 }),
  });
  const assets: Array<{ id: string; name: string; assetTag: string }> = assetsData?.data ?? [];

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CreateCredentialInput>({
    resolver: zodResolver(CreateCredentialSchema),
    defaultValues: editing
      ? {
          title: editing.title,
          username: editing.username ?? '',
          password: '',
          url: editing.url ?? '',
          notes: editing.notes ?? '',
          category: editing.category as CreateCredentialInput['category'],
          linkedAsset: editing.linkedAsset?.id ?? '',
          tags: editing.tags,
        }
      : { category: CredentialCategory.OTHER, tags: [] },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateCredentialInput) =>
      editing ? updateCredential(editing.id, data) : createCredential(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
      reset();
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Credential' : 'Add Credential'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <Field label="Title *" error={errors.title?.message}>
            <Input placeholder="e.g. Office 365 Global Admin" {...register('title')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select
                defaultValue={editing?.category ?? CredentialCategory.OTHER}
                onValueChange={(v) => setValue('category', v as CreateCredentialInput['category'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Linked Asset">
              <Select
                defaultValue={editing?.linkedAsset?.id ?? 'none'}
                onValueChange={(v) => setValue('linkedAsset', v === 'none' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.assetTag} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Username / Account">
            <Input placeholder="e.g. admin@company.com" {...register('username')} />
          </Field>

          <Field label={editing ? 'Password (leave blank to keep current)' : 'Password *'} error={errors.password?.message}>
            <Input type="password" placeholder="••••••••" {...register('password')} />
          </Field>

          <Field label="URL">
            <Input placeholder="e.g. https://admin.microsoft.com" {...register('url')} />
          </Field>

          <Field label="Notes">
            <Textarea rows={3} placeholder="Any relevant notes..." {...register('notes')} />
          </Field>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Credential'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Audit log panel ───────────────────────────────────────────────────────────

function AuditPanel() {
  const { data = [] } = useQuery({
    queryKey: ['vault', 'audit'],
    queryFn: () => getAuditLog(),
  });

  const ACTION_COLOURS: Record<string, string> = {
    view: 'bg-blue-100 text-blue-800',
    copy: 'bg-purple-100 text-purple-800',
    create: 'bg-green-100 text-green-800',
    update: 'bg-yellow-100 text-yellow-800',
    delete: 'bg-red-100 text-red-800',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" /> Audit Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events yet.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {data.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`shrink-0 inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${ACTION_COLOURS[entry.action] ?? 'bg-gray-100 text-gray-700'}`}>
                    {entry.action}
                  </span>
                  <span className="font-medium truncate">{entry.credential.title}</span>
                  <span className="text-muted-foreground shrink-0">by {entry.user.displayName}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function VaultPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialResponse | undefined>();
  const [showAudit, setShowAudit] = useState(false);
  const [search, setSearch] = useState('');

  const queryClient = useQueryClient();

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ['vault'],
    queryFn: listCredentials,
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteCredential,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vault'] }),
  });

  function openCreate() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(c: CredentialResponse) {
    setEditing(c);
    setModalOpen(true);
  }

  // Group by category
  const filtered = (credentials as CredentialResponse[]).filter(
    (c) => !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.username?.toLowerCase().includes(search.toLowerCase()),
  );

  const groups = Object.values(CredentialCategory).reduce<Record<string, CredentialResponse[]>>(
    (acc, cat) => {
      acc[cat] = filtered.filter((c) => c.category === cat);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" /> Password Vault
          </h1>
          <p className="text-sm text-muted-foreground">Encrypted credentials — IT staff only</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowAudit((v) => !v)} className="gap-1.5">
              <ClipboardList className="h-4 w-4" />
              {showAudit ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" onClick={openCreate} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Credential
            </Button>
          )}
        </div>
      </div>

      {showAudit && isAdmin && <AuditPanel />}

      <Input
        placeholder="Search credentials..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            {search ? 'No credentials match your search.' : 'No credentials stored yet.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groups).map(([cat, items]) => {
            if (items.length === 0) return null;
            return (
              <Card key={cat}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_COLOURS[cat]}`}>
                      {CATEGORY_LABELS[cat]}
                    </span>
                    <span className="text-muted-foreground font-normal">{items.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground w-48">Title</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground w-48">Username</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Password</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Linked Asset</th>
                        <th className="px-4 py-2 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{c.title}</div>
                            {c.url && (
                              <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate block max-w-[180px]">
                                {c.url}
                              </a>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-sm text-muted-foreground">
                            {c.username || <span className="italic">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <PasswordCell id={c.id} />
                          </td>
                          <td className="px-4 py-2.5">
                            {c.linkedAsset ? (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                                {c.linkedAsset.assetTag}
                              </span>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            {isAdmin && (
                              <div className="flex gap-1 justify-end">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 hover:text-destructive"
                                  onClick={() => { if (confirm(`Delete "${c.title}"?`)) doDelete(c.id); }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <CredentialModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        editing={editing}
      />
    </div>
  );
}
