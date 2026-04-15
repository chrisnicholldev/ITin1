import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CheckSquare, Square, ChevronDown, ChevronUp, UserPlus, UserMinus, ListChecks, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getTemplates, getRuns, createTemplate, updateTemplate, deleteTemplate,
  createRun, updateRun, deleteRun, toggleItem,
  type ChecklistTemplate, type ChecklistRun,
} from '@/api/checklists';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  onboarding:  'Onboarding',
  offboarding: 'Offboarding',
  other:       'Other',
};

const TYPE_COLOURS: Record<string, string> = {
  onboarding:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  offboarding: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  other:       'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400',
};

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ run }: { run: ChecklistRun }) {
  const { completed, total, requiredCompleted, required } = run.progress;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const colour = run.status === 'completed' ? 'bg-green-500' : pct >= 75 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-zinc-300';

  return (
    <div className="space-y-0.5">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden w-32">
        <div className={`h-full rounded-full transition-all ${colour}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{completed}/{total} · {requiredCompleted}/{required} required</p>
    </div>
  );
}

// ── Template form modal ───────────────────────────────────────────────────────

interface TemplateItem { title: string; description: string; category: string; required: boolean }

function TemplateModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: ChecklistTemplate }) {
  const queryClient = useQueryClient();
  const [name,        setName]        = useState(editing?.name ?? '');
  const [type,        setType]        = useState(editing?.type ?? 'onboarding');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [items,       setItems]       = useState<TemplateItem[]>(
    editing?.items.map((i) => ({ title: i.title, description: i.description ?? '', category: i.category ?? '', required: i.required })) ??
    [{ title: '', description: '', category: '', required: true }]
  );

  function addItem()       { setItems([...items, { title: '', description: '', category: '', required: true }]); }
  function removeItem(i: number) { setItems(items.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, field: keyof TemplateItem, value: string | boolean) {
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        type: type as ChecklistTemplate['type'],
        description: description.trim() || undefined,
        items: items.filter((i) => i.title.trim()).map((i) => ({
          title:       i.title.trim(),
          description: i.description.trim() || undefined,
          category:    i.category.trim() || undefined,
          required:    i.required,
        })),
      };
      return editing ? updateTemplate(editing.id, payload) : createTemplate(payload);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['checklist-templates'] }); onClose(); },
  });

  const validItems = items.filter((i) => i.title.trim()).length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit template' : 'New checklist template'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Template name <span className="text-destructive">*</span></Label>
              <Input placeholder="e.g. New Employee Onboarding" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as ChecklistTemplate['type'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Checklist items <span className="text-destructive">*</span></Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5" /> Add item
              </Button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start p-3 border rounded-md bg-muted/30">
                  <GripVertical className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Task title *"
                      value={item.title}
                      onChange={(e) => updateItem(i, 'title', e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Category (e.g. IT, HR, Manager)"
                        value={item.category}
                        onChange={(e) => updateItem(i, 'category', e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={item.description}
                        onChange={(e) => updateItem(i, 'description', e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`req-${i}`}
                        checked={item.required}
                        onChange={(e) => updateItem(i, 'required', e.target.checked)}
                        className="h-3.5 w-3.5"
                      />
                      <label htmlFor={`req-${i}`} className="text-xs text-muted-foreground cursor-pointer">Required</label>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0 mt-1" onClick={() => removeItem(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{(error as any)?.response?.data?.error ?? 'An error occurred'}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !name.trim() || validItems === 0}>
            {isPending ? 'Saving…' : editing ? 'Save template' : 'Create template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Start run modal ───────────────────────────────────────────────────────────

function StartRunModal({ open, onClose, templates }: { open: boolean; onClose: () => void; templates: ChecklistTemplate[] }) {
  const queryClient = useQueryClient();
  const [templateId,   setTemplateId]   = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [department,   setDepartment]   = useState('');
  const [assignedTo,   setAssignedTo]   = useState('');
  const [dueDate,      setDueDate]      = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createRun({
      templateId,
      employeeName:       employeeName.trim(),
      employeeDepartment: department.trim() || undefined,
      assignedTo:         assignedTo.trim() || undefined,
      dueDate:            dueDate ? new Date(dueDate).toISOString() : undefined,
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['checklist-runs'] }); onClose(); },
  });

  const selectedTemplate = templates.find((t) => t.id === templateId);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Start checklist</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Template <span className="text-destructive">*</span></Label>
            <Select value={templateId || '__none__'} onValueChange={(v) => setTemplateId(v === '__none__' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Select a template…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select a template…</SelectItem>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {TYPE_LABELS[t.type]} — {t.name} ({t.itemCount} items)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Employee name <span className="text-destructive">*</span></Label>
            <Input placeholder="e.g. John Smith" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input placeholder="e.g. Finance" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Assigned to (IT)</Label>
              <Input placeholder="Your name" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          {error && <p className="text-sm text-destructive">{(error as any)?.response?.data?.error ?? 'An error occurred'}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !templateId || !employeeName.trim()}>
            {isPending ? 'Starting…' : 'Start checklist'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Run card (expandable) ─────────────────────────────────────────────────────

function RunCard({ run, isAdmin }: { run: ChecklistRun; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { mutate: doToggle } = useMutation({
    mutationFn: ({ itemId }: { itemId: string }) => toggleItem(run.id, itemId),
    onSuccess: (updated) => {
      queryClient.setQueryData(['checklist-runs'], (old: ChecklistRun[] | undefined) =>
        old?.map((r) => r.id === updated.id ? updated : r) ?? [updated]
      );
    },
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: () => deleteRun(run.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['checklist-runs'] }),
  });

  const { mutate: doStatus } = useMutation({
    mutationFn: (status: ChecklistRun['status']) => updateRun(run.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['checklist-runs'] }),
  });

  // Group items by category
  const categories = Array.from(new Set(run.items.map((i) => i.category ?? ''))).filter(Boolean);
  const uncategorised = run.items.filter((i) => !i.category);

  return (
    <Card className={run.status === 'completed' ? 'opacity-75' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLOURS[run.type]}`}>
                {TYPE_LABELS[run.type]}
              </span>
              <h3 className="text-sm font-semibold">{run.employeeName}</h3>
              {run.employeeDepartment && <span className="text-xs text-muted-foreground">· {run.employeeDepartment}</span>}
              {run.status === 'completed' && <Badge variant="success" className="text-xs">Completed</Badge>}
              {run.status === 'cancelled' && <Badge variant="secondary" className="text-xs">Cancelled</Badge>}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{run.templateName}</p>
                {run.assignedTo && <p className="text-xs text-muted-foreground">Assigned to: {run.assignedTo}</p>}
                {run.dueDate && (
                  <p className={`text-xs ${new Date(run.dueDate) < new Date() && run.status === 'in_progress' ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                    Due: {new Date(run.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <ProgressBar run={run} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {run.status === 'in_progress' && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => doStatus('completed')}>
                Mark done
              </Button>
            )}
            {run.status === 'completed' && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => doStatus('in_progress')}>
                Reopen
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
            {isAdmin && (
              <Button
                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => { if (confirm(`Delete checklist for ${run.employeeName}?`)) doDelete(); }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Expanded items */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t pt-4">
            {/* Categorised items */}
            {categories.map((cat) => (
              <div key={cat}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{cat}</p>
                <div className="space-y-1">
                  {run.items.filter((i) => i.category === cat).map((item) => (
                    <ItemRow key={item.id} item={item} run={run} onToggle={() => doToggle({ itemId: item.id })} />
                  ))}
                </div>
              </div>
            ))}

            {/* Uncategorised items */}
            {uncategorised.length > 0 && (
              <div>
                {categories.length > 0 && <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Other</p>}
                <div className="space-y-1">
                  {uncategorised.map((item) => (
                    <ItemRow key={item.id} item={item} run={run} onToggle={() => doToggle({ itemId: item.id })} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ItemRow({ item, run, onToggle }: {
  item: ChecklistRun['items'][number];
  run: ChecklistRun;
  onToggle: () => void;
}) {
  return (
    <div className={`flex items-start gap-2.5 p-2 rounded-md transition-colors ${item.completed ? 'bg-muted/30' : 'hover:bg-muted/30'}`}>
      <button
        type="button"
        onClick={onToggle}
        disabled={run.status === 'cancelled'}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        {item.completed
          ? <CheckSquare className="h-4 w-4 text-green-600" />
          : <Square className="h-4 w-4" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
          {item.title}
          {!item.required && <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
        </p>
        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
        {item.completed && item.completedBy && (
          <p className="text-xs text-muted-foreground">
            ✓ {item.completedBy} · {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ChecklistsPage() {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const queryClient = useQueryClient();

  const [activeTab,         setActiveTab]         = useState<'runs' | 'templates'>('runs');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate,   setEditingTemplate]   = useState<ChecklistTemplate | undefined>();
  const [startRunOpen,      setStartRunOpen]       = useState(false);
  const [filterStatus,      setFilterStatus]       = useState('in_progress');
  const [filterType,        setFilterType]         = useState('');

  const { data: templates = [] } = useQuery<ChecklistTemplate[]>({
    queryKey: ['checklist-templates'],
    queryFn: getTemplates,
  });

  const { data: runs = [], isLoading } = useQuery<ChecklistRun[]>({
    queryKey: ['checklist-runs', { filterStatus, filterType }],
    queryFn: () => getRuns({ status: filterStatus || undefined, type: filterType || undefined }),
  });

  const { mutate: doDeleteTemplate } = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['checklist-templates'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Checklists</h1>
          <p className="text-sm text-muted-foreground">Onboarding &amp; offboarding task lists</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => { setEditingTemplate(undefined); setTemplateModalOpen(true); }}>
              <ListChecks className="w-4 h-4" /> New template
            </Button>
          )}
          <Button onClick={() => setStartRunOpen(true)} disabled={templates.length === 0}>
            <Plus className="w-4 h-4" /> Start checklist
          </Button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 border-b">
        {(['runs', 'templates'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'runs' ? 'Active checklists' : `Templates (${templates.length})`}
          </button>
        ))}
      </div>

        {/* ── Runs tab ── */}
        {activeTab === 'runs' && <div className="space-y-4 mt-4">
          <div className="flex flex-wrap gap-2">
            <Select value={filterStatus || '__all__'} onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All statuses</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType || '__all__'} onValueChange={(v) => setFilterType(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="All types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All types</SelectItem>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {isLoading && <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>}

          {!isLoading && runs.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                {filterStatus === 'in_progress'
                  ? <UserPlus className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
                  : <UserMinus className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
                }
                <p className="text-sm text-muted-foreground">No checklists found.</p>
                {templates.length > 0 && (
                  <Button variant="outline" className="mt-3" onClick={() => setStartRunOpen(true)}>
                    <Plus className="w-4 h-4" /> Start a checklist
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {runs.map((run) => <RunCard key={run.id} run={run} isAdmin={isAdmin} />)}
          </div>
        </div>}

        {/* ── Templates tab ── */}
        {activeTab === 'templates' && <div className="mt-4">
          {templates.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <ListChecks className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">No templates yet.</p>
                {isAdmin && (
                  <Button variant="outline" className="mt-3" onClick={() => { setEditingTemplate(undefined); setTemplateModalOpen(true); }}>
                    <Plus className="w-4 h-4" /> Create first template
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {templates.map((t) => (
                <Card key={t.id} className="flex flex-col">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_COLOURS[t.type]}`}>
                          {TYPE_LABELS[t.type]}
                        </span>
                        <CardTitle className="text-sm mt-1">{t.name}</CardTitle>
                        {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTemplate(t); setTemplateModalOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm(`Delete template "${t.name}"?`)) doDeleteTemplate(t.id); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 flex-1">
                    <p className="text-xs text-muted-foreground mb-2">{t.itemCount} items</p>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {t.items.map((item) => (
                        <div key={item.id} className="flex items-start gap-1.5">
                          <Square className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="text-xs min-w-0">
                            <span className="truncate">{item.title}</span>
                            {item.category && <span className="ml-1 text-muted-foreground">· {item.category}</span>}
                            {!item.required && <span className="ml-1 text-muted-foreground italic">optional</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline" size="sm" className="w-full mt-3 h-7 text-xs"
                      onClick={() => setStartRunOpen(true)}
                    >
                      Use this template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>}

      <TemplateModal
        key={editingTemplate?.id ?? 'new-template'}
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        editing={editingTemplate}
      />
      <StartRunModal open={startRunOpen} onClose={() => setStartRunOpen(false)} templates={templates} />
    </div>
  );
}
