import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Shield, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listCredentials, deleteCredential, getAuditLog } from '@/api/vault';
import { CredentialCategory, type CredentialResponse } from '@itdesk/shared';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';
import { PasswordCell } from '@/components/vault/PasswordCell';
import { CredentialModal } from '@/components/vault/CredentialModal';

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
    queryFn: () => listCredentials(),
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteCredential,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vault'] }),
  });

  function openCreate() { setEditing(undefined); setModalOpen(true); }
  function openEdit(c: CredentialResponse) { setEditing(c); setModalOpen(true); }

  const filtered = (credentials as CredentialResponse[]).filter(
    (c) => !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.username?.toLowerCase().includes(search.toLowerCase()),
  );

  const groups = Object.values(CredentialCategory).reduce<Record<string, CredentialResponse[]>>(
    (acc, cat) => { acc[cat] = filtered.filter((c) => c.category === cat); return acc; },
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
