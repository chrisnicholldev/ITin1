import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getChangelogEntries, createChangelogEntry, updateChangelogEntry, deleteChangelogEntry, type ChangelogEntry } from '@/api/changelog';
import { useAuthStore } from '@/stores/auth.store';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  infrastructure:  'Infrastructure',
  network:         'Network',
  security:        'Security',
  software:        'Software',
  hardware:        'Hardware',
  user_management: 'User management',
  policy:          'Policy',
  vendor:          'Vendor',
  other:           'Other',
};

const CATEGORY_COLOURS: Record<string, string> = {
  infrastructure:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  network:         'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  security:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  software:        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  hardware:        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  user_management: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  policy:          'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  vendor:          'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  other:           'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
};

// ── Entry form modal ──────────────────────────────────────────────────────────

function EntryModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: ChangelogEntry }) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [title,           setTitle]           = useState(editing?.title ?? '');
  const [category,        setCategory]        = useState(editing?.category ?? 'other');
  const [description,     setDescription]     = useState(editing?.description ?? '');
  const [performedBy,     setPerformedBy]     = useState(editing?.performedBy ?? user?.displayName ?? '');
  const [occurredAt,      setOccurredAt]      = useState(
    editing?.occurredAt ? editing.occurredAt.slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [affectedSystems, setAffectedSystems] = useState(editing?.affectedSystems?.join(', ') ?? '');
  const [tags,            setTags]            = useState(editing?.tags?.join(', ') ?? '');
  const [rollbackNotes,   setRollbackNotes]   = useState(editing?.rollbackNotes ?? '');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = {
        title:           title.trim(),
        category:        category as ChangelogEntry['category'],
        description:     description.trim(),
        performedBy:     performedBy.trim() || undefined,
        occurredAt:      occurredAt ? new Date(occurredAt).toISOString() : undefined,
        affectedSystems: affectedSystems.split(',').map((s) => s.trim()).filter(Boolean),
        tags:            tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean),
        rollbackNotes:   rollbackNotes.trim() || undefined,
      };
      return editing ? updateChangelogEntry(editing.id, payload) : createChangelogEntry(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['changelog'] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit entry' : 'Log a change'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. Upgraded ESXi on NAS01 to v8.0.2" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ChangelogEntry['category'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date &amp; time</Label>
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="What was changed, why, and any relevant details…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Performed by</Label>
            <Input placeholder="Your name" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Affected systems</Label>
            <Input placeholder="e.g. NAS01, DC01, Firewall" value={affectedSystems} onChange={(e) => setAffectedSystems(e.target.value)} />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          <div className="space-y-1.5">
            <Label>Rollback notes</Label>
            <Textarea
              placeholder="How to reverse this change if needed…"
              value={rollbackNotes}
              onChange={(e) => setRollbackNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Input placeholder="e.g. planned, emergency, maintenance" value={tags} onChange={(e) => setTags(e.target.value)} />
            <p className="text-xs text-muted-foreground">Comma-separated</p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{(error as any)?.response?.data?.error ?? 'An error occurred'}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !title.trim() || !description.trim()}>
            {isPending ? (editing ? 'Saving…' : 'Logging…') : (editing ? 'Save' : 'Log change')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ChangelogPage() {
  const queryClient = useQueryClient();

  const [modalOpen,       setModalOpen]       = useState(false);
  const [editing,         setEditing]         = useState<ChangelogEntry | undefined>();
  const [search,          setSearch]          = useState('');
  const [filterCategory,  setFilterCategory]  = useState('');
  const [page,            setPage]            = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['changelog', { search, filterCategory, page }],
    queryFn: () => getChangelogEntries({
      search:   search || undefined,
      category: filterCategory || undefined,
      page,
      limit: 50,
    }),
  });

  const entries = data?.data ?? [];
  const meta    = data?.meta;

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteChangelogEntry,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changelog'] }),
  });

  function openAdd() { setEditing(undefined); setModalOpen(true); }
  function openEdit(e: ChangelogEntry) { setEditing(e); setModalOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IT Change Log</h1>
          <p className="text-sm text-muted-foreground">
            {meta ? `${meta.total} entries recorded` : 'Running record of infrastructure changes'}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" /> Log change
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search title or description…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="h-9 w-64"
        />
        <Select value={filterCategory || '__all__'} onValueChange={(v) => { setFilterCategory(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>}

      {!isLoading && entries.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {search || filterCategory ? 'No entries match your filters.' : 'No changes logged yet.'}
            </p>
            {!search && !filterCategory && (
              <Button variant="outline" className="mt-3" onClick={openAdd}>
                <Plus className="w-4 h-4" /> Log your first change
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <div className="space-y-3">
        {entries.map((entry) => (
          <Card key={entry.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Header row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLOURS[entry.category]}`}>
                      {CATEGORY_LABELS[entry.category]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(entry.occurredAt).toLocaleString()}
                    </span>
                    {entry.performedBy && (
                      <span className="text-xs text-muted-foreground">· {entry.performedBy}</span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold leading-snug">{entry.title}</h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{entry.description}</p>

                  {/* Affected systems */}
                  {entry.affectedSystems?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.affectedSystems.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Rollback notes */}
                  {entry.rollbackNotes && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Rollback notes</summary>
                      <p className="mt-1 text-muted-foreground whitespace-pre-wrap pl-2 border-l-2 border-muted">{entry.rollbackNotes}</p>
                    </details>
                  )}

                  {/* Tags */}
                  {entry.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {entry.tags.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm('Delete this entry?')) doDelete(entry.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-sm text-muted-foreground">Page {page} of {meta.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      <EntryModal key={editing?.id ?? 'new'} open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
