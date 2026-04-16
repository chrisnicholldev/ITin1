import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Pencil, Trash2, Shield, ChevronDown, ChevronUp, ClipboardList,
  Upload, Lock, Share2, Folder, FolderOpen, FolderPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  listCredentials, deleteCredential, bulkDeleteCredentials, getAuditLog,
  listFolders, createFolder, updateFolder, deleteFolder,
} from '@/api/vault';
import { CredentialCategory, VaultAccessLevel, type CredentialResponse, type VaultFolderResponse } from '@itdesk/shared';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';
import { PasswordCell } from '@/components/vault/PasswordCell';
import { CredentialModal } from '@/components/vault/CredentialModal';
import { ImportCredentialsModal } from '@/components/vault/ImportCredentialsModal';
import { SecureShareModal } from '@/components/vault/SecureShareModal';

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

// ── Folder modal ──────────────────────────────────────────────────────────────

function FolderModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: VaultFolderResponse;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name ?? '');
  const [icon, setIcon] = useState(editing?.icon ?? '');
  const [colour, setColour] = useState(editing?.colour ?? '');

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), icon: icon.trim() || undefined, colour: colour.trim() || undefined };
      if (editing) {
        return updateFolder(editing.id, payload);
      }
      return createFolder({ ...payload, sortOrder: 0 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'folders'] });
      onClose();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold">{editing ? 'Edit Folder' : 'New Folder'}</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Infrastructure" autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Icon (emoji or text)</label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. 🖥️" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Colour (CSS colour)</label>
            <Input value={colour} onChange={(e) => setColour(e.target.value)} placeholder="e.g. #3b82f6" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={isPending || !name.trim()} onClick={() => mutate()}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Folder sidebar ────────────────────────────────────────────────────────────

function FolderSidebar({
  isAdmin,
  selected,
  onSelect,
  totalCount,
}: {
  isAdmin: boolean;
  selected: string | null; // null = all, 'none' = unfiled
  onSelect: (id: string | null) => void;
  totalCount: number;
}) {
  const queryClient = useQueryClient();
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<VaultFolderResponse | undefined>();

  const { data: folders = [] } = useQuery<VaultFolderResponse[]>({
    queryKey: ['vault', 'folders'],
    queryFn: listFolders,
  });

  const { mutate: doDeleteFolder } = useMutation({
    mutationFn: deleteFolder,
    onSuccess: (_, deletedId) => {
      if (selected === deletedId) onSelect(null);
      queryClient.invalidateQueries({ queryKey: ['vault', 'folders'] });
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });

  const unfiledCount = totalCount - folders.reduce((sum, f) => sum + f.credentialCount, 0);

  return (
    <>
      <div className="w-52 shrink-0 space-y-1">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Folders</span>
          {isAdmin && (
            <button
              className="text-muted-foreground hover:text-foreground"
              title="New folder"
              onClick={() => { setEditingFolder(undefined); setFolderModalOpen(true); }}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <button
          className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${selected === null ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
          onClick={() => onSelect(null)}
        >
          <span className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" />
            All Credentials
          </span>
          <span className="text-xs opacity-70">{totalCount}</span>
        </button>

        {folders.map((f) => (
          <div
            key={f.id}
            className={`group flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer transition-colors ${selected === f.id ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            onClick={() => onSelect(f.id)}
          >
            <span className="flex items-center gap-2 min-w-0">
              {selected === f.id ? <FolderOpen className="h-3.5 w-3.5 shrink-0" /> : <Folder className="h-3.5 w-3.5 shrink-0" />}
              {f.icon && <span className="text-xs">{f.icon}</span>}
              <span className="truncate">{f.name}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-xs opacity-70">{f.credentialCount}</span>
              {isAdmin && (
                <span className="hidden group-hover:flex items-center gap-0.5 ml-1">
                  <button
                    className="hover:text-foreground opacity-60"
                    onClick={(e) => { e.stopPropagation(); setEditingFolder(f); setFolderModalOpen(true); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="hover:text-destructive opacity-60"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete folder "${f.name}"? Credentials will become unfiled.`)) doDeleteFolder(f.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              )}
            </span>
          </div>
        ))}

        {unfiledCount > 0 && (
          <button
            className={`w-full text-left flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${selected === 'none' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            onClick={() => onSelect('none')}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Folder className="h-3.5 w-3.5" />
              Unfiled
            </span>
            <span className="text-xs opacity-70">{unfiledCount}</span>
          </button>
        )}
      </div>

      <FolderModal
        open={folderModalOpen}
        onClose={() => { setFolderModalOpen(false); setEditingFolder(undefined); }}
        editing={editingFolder}
      />
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function VaultPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<CredentialResponse | undefined>();
  const [showAudit, setShowAudit] = useState(false);
  const [shareTarget, setShareTarget] = useState<
    { contentType: 'credential'; id: string; title: string } | { contentType: 'note' } | null
  >(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: allCredentials = [] } = useQuery({
    queryKey: ['vault'],
    queryFn: () => listCredentials(),
  });

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ['vault', 'folder', selectedFolder],
    queryFn: () => listCredentials(undefined, undefined, selectedFolder ?? undefined),
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteCredential,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
      queryClient.invalidateQueries({ queryKey: ['vault', 'folders'] });
    },
  });

  const { mutate: doBulkDelete, isPending: bulkPending } = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteCredentials(ids),
    onSuccess: () => {
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['vault'] });
      queryClient.invalidateQueries({ queryKey: ['vault', 'folders'] });
    },
  });

  function handleFolderSelect(id: string | null) {
    setSelectedFolder(id);
    setSelected(new Set());
    setSearch('');
  }

  function openCreate() { setEditing(undefined); setModalOpen(true); }
  function openEdit(c: CredentialResponse) { setEditing(c); setModalOpen(true); }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll(items: CredentialResponse[]) {
    setSelected((prev) => {
      const allSelected = items.every((c) => prev.has(c.id));
      const next = new Set(prev);
      items.forEach((c) => allSelected ? next.delete(c.id) : next.add(c.id));
      return next;
    });
  }

  const filtered = (credentials as CredentialResponse[]).filter(
    (c) => !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.username?.toLowerCase().includes(search.toLowerCase()),
  );

  const groups = Object.values(CredentialCategory).reduce<Record<string, CredentialResponse[]>>(
    (acc, cat) => { acc[cat] = filtered.filter((c) => c.category === cat); return acc; },
    {},
  );

  return (
    <div className="space-y-4">
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
          <Button variant="outline" size="sm" onClick={() => setShareTarget({ contentType: 'note' })} className="gap-1.5">
            <Share2 className="h-4 w-4" /> Secure Note
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5">
              <Upload className="h-4 w-4" /> Import
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

      <div className="flex gap-5">
        <FolderSidebar
          isAdmin={isAdmin}
          selected={selectedFolder}
          onSelect={handleFolderSelect}
          totalCount={(allCredentials as CredentialResponse[]).length}
        />

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Input
              placeholder="Search credentials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            {isAdmin && selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={bulkPending}
                  onClick={() => {
                    if (confirm(`Delete ${selected.size} credential${selected.size !== 1 ? 's' : ''}?`)) {
                      doBulkDelete(Array.from(selected));
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete selected
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                {search ? 'No credentials match your search.' : 'No credentials in this folder.'}
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
                            {isAdmin && (
                              <th className="px-3 py-2 w-8">
                                <input
                                  type="checkbox"
                                  checked={items.every((c) => selected.has(c.id))}
                                  onChange={() => toggleSelectAll(items)}
                                  className="cursor-pointer"
                                />
                              </th>
                            )}
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-48">Title</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground w-48">Username</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Password</th>
                            <th className="text-left px-4 py-2 font-medium text-muted-foreground">Linked Asset</th>
                            <th className="px-4 py-2 w-24" />
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((c) => (
                            <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/20 ${selected.has(c.id) ? 'bg-muted/30' : ''}`}>
                              {isAdmin && (
                                <td className="px-3 py-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selected.has(c.id)}
                                    onChange={() => toggleSelect(c.id)}
                                    className="cursor-pointer"
                                  />
                                </td>
                              )}
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  {c.accessLevel === VaultAccessLevel.RESTRICTED && (
                                    <Lock className="h-3 w-3 text-orange-500 shrink-0" aria-label="Restricted access" />
                                  )}
                                  {c.accessLevel === VaultAccessLevel.ADMIN && (
                                    <Lock className="h-3 w-3 text-blue-500 shrink-0" aria-label="Admin only" />
                                  )}
                                  <span className="font-medium">{c.title}</span>
                                </div>
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
                                <div className="flex gap-1 justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    title="Send as secure link"
                                    onClick={() => setShareTarget({ contentType: 'credential', id: c.id, title: c.title })}
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                  </Button>
                                  {isAdmin && (
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 hover:text-destructive"
                                      onClick={() => { if (confirm(`Delete "${c.title}"?`)) doDelete(c.id); }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
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
        </div>
      </div>

      <CredentialModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        editing={editing}
        defaultFolderId={selectedFolder !== 'none' ? selectedFolder ?? undefined : undefined}
      />
      <ImportCredentialsModal open={importOpen} onClose={() => setImportOpen(false)} />
      {shareTarget && (
        <SecureShareModal target={shareTarget} onClose={() => setShareTarget(null)} />
      )}
    </div>
  );
}
