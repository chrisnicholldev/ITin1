import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Tag, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/api/categories';
import type { CategoryResponse } from '@itdesk/shared';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const PRIORITY_COLOURS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

function CategoryModal({
  open, onClose, editing,
}: {
  open: boolean;
  onClose: () => void;
  editing?: CategoryResponse;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [defaultPriority, setDefaultPriority] = useState<string>(editing?.defaultPriority ?? 'medium');
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [subcategories, setSubcategories] = useState<string[]>(editing?.subcategories ?? []);
  const [subInput, setSubInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addSubcategory() {
    const val = subInput.trim();
    if (!val || subcategories.includes(val)) return;
    setSubcategories([...subcategories, val]);
    setSubInput('');
  }

  function removeSubcategory(s: string) {
    setSubcategories(subcategories.filter((x) => x !== s));
  }

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        defaultPriority: defaultPriority as any,
        subcategories,
        isActive,
      };
      return editing
        ? updateCategory(editing.id, payload)
        : createCategory({ ...payload, subcategories });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    },
    onError: (e: any) => setError(e?.response?.data?.error ?? e?.message ?? 'Failed to save'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Category' : 'New Category'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hardware" />
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          </div>

          <div className="space-y-1.5">
            <Label>Default Priority</Label>
            <Select value={defaultPriority} onValueChange={setDefaultPriority}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Subcategories</Label>
            <div className="flex gap-2">
              <Input
                value={subInput}
                onChange={(e) => setSubInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubcategory(); } }}
                placeholder="Add subcategory…"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addSubcategory} disabled={!subInput.trim()}>
                Add
              </Button>
            </div>
            {subcategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {subcategories.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-1">
                    {s}
                    <button type="button" onClick={() => removeSubcategory(s)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {editing && (
            <div className="flex items-center gap-3">
              <input
                id="active"
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-input accent-primary"
              />
              <Label htmlFor="active">Active</Label>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={!name.trim() || isPending}>
            {isPending ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryResponse | undefined>();
  const [showInactive, setShowInactive] = useState(false);

  const { data: categories = [] } = useQuery<CategoryResponse[]>({
    queryKey: ['categories', showInactive],
    queryFn: () => getCategories(!showInactive),
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    onError: (e: any) => alert(e?.response?.data?.error ?? 'Could not delete category'),
  });

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ticket categories and subcategories</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive((v) => !v)}
            className="gap-1.5"
          >
            {showInactive ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </Button>
          <Button onClick={() => { setEditing(undefined); setModalOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Category
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No categories found.
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setModalOpen(true); }}>
                Add your first category
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat) => (
            <Card key={cat.id} className={cat.isActive ? '' : 'opacity-60'}>
              <CardContent className="py-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Tag className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{cat.name}</span>
                        {!cat.isActive && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                        {cat.defaultPriority && (
                          <span className={`text-xs border rounded px-1.5 py-0.5 ${PRIORITY_COLOURS[cat.defaultPriority] ?? ''}`}>
                            {PRIORITY_LABELS[cat.defaultPriority] ?? cat.defaultPriority}
                          </span>
                        )}
                      </div>
                      {cat.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                      )}
                      {cat.subcategories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {cat.subcategories.map((s) => (
                            <span key={s} className="text-xs bg-muted rounded px-1.5 py-0.5">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => { setEditing(cat); setModalOpen(true); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 hover:text-destructive"
                      onClick={() => { if (confirm(`Deactivate "${cat.name}"?`)) doDelete(cat.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CategoryModal
        key={editing?.id ?? 'new'}
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        editing={editing}
      />
    </div>
  );
}
