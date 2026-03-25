import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { getRack, addMount, updateMount, removeMount } from '@/api/racks';
import { getAssets } from '@/api/assets';
import { CreateRackMountSchema, type CreateRackMountInput, type RackMountResponse, type RackResponse } from '@itdesk/shared';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

const TYPE_COLOURS: Record<string, string> = {
  server:       'bg-blue-600 border-blue-700 text-white',
  switch:       'bg-green-600 border-green-700 text-white',
  router:       'bg-purple-600 border-purple-700 text-white',
  firewall:     'bg-red-600 border-red-700 text-white',
  access_point: 'bg-yellow-500 border-yellow-600 text-white',
  patch_panel:  'bg-gray-500 border-gray-600 text-white',
  other:        'bg-slate-500 border-slate-600 text-white',
};

function typeColour(type?: string) {
  return TYPE_COLOURS[type ?? 'other'] ?? TYPE_COLOURS['other'];
}

// ── Mount modal ───────────────────────────────────────────────────────────────

function MountModal({
  open, onClose, rackId, totalU, preStartU, preFace, editing,
}: {
  open: boolean;
  onClose: () => void;
  rackId: string;
  totalU: number;
  preStartU?: number;
  preFace?: 'front' | 'back' | 'both';
  editing?: RackMountResponse;
}) {
  const queryClient = useQueryClient();

  const [useAsset, setUseAsset] = useState(!editing?.label || !!editing?.asset);
  const [assetSearch, setAssetSearch] = useState(
    editing?.asset ? `${editing.asset.assetTag} — ${editing.asset.name}` : ''
  );
  const [assetDropOpen, setAssetDropOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(editing?.asset?.id);

  const { data: assetsData } = useQuery({
    queryKey: ['assets', 'rack-search', assetSearch, selectedAssetId],
    queryFn: () => getAssets({ limit: 50, ...(assetSearch && !selectedAssetId ? { search: assetSearch } : {}) }),
  });
  const assets: any[] = assetsData?.data ?? [];

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CreateRackMountInput>({
    resolver: zodResolver(CreateRackMountSchema),
    defaultValues: editing
      ? { assetId: editing.asset?.id, label: editing.label, startU: editing.startU, endU: editing.endU, face: editing.face ?? 'both', notes: editing.notes ?? '' }
      : { startU: preStartU ?? 1, endU: preStartU ?? 1, face: preFace ?? 'both', notes: '' },
  });

  const startU = watch('startU');
  const face = watch('face');

  const { mutate, isPending, error: mutError } = useMutation({
    mutationFn: (data: CreateRackMountInput) =>
      editing
        ? updateMount(rackId, editing.id, { startU: data.startU, endU: data.endU, face: data.face, label: data.label, notes: data.notes })
        : addMount(rackId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks', rackId] });
      onClose();
    },
  });

  const assetRefEl = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (assetRefEl.current && !assetRefEl.current.contains(e.target as Node)) {
        setAssetDropOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Mount' : 'Mount Device'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">

          {/* Asset or label toggle */}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={useAsset ? 'default' : 'outline'} onClick={() => setUseAsset(true)}>Asset</Button>
            <Button type="button" size="sm" variant={!useAsset ? 'default' : 'outline'} onClick={() => setUseAsset(false)}>Label only</Button>
          </div>

          {useAsset ? (
            <div className="space-y-1.5" ref={assetRefEl}>
              <Label>Asset *</Label>
              <div className="relative">
                <Input
                  placeholder="Search by name or asset tag…"
                  value={assetSearch}
                  onChange={(e) => {
                    setAssetSearch(e.target.value);
                    setSelectedAssetId(undefined);
                    setValue('assetId', undefined);
                    setAssetDropOpen(true);
                  }}
                  onFocus={() => setAssetDropOpen(true)}
                  className={selectedAssetId ? 'border-primary' : ''}
                />
                {assetDropOpen && assets.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border rounded-md shadow-md max-h-52 overflow-y-auto">
                    {assets.map((a: any) => (
                      <button
                        key={a.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSelectedAssetId(a.id);
                          setValue('assetId', a.id);
                          setAssetSearch(`${a.assetTag} — ${a.name}`);
                          setAssetDropOpen(false);
                        }}
                      >
                        <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{a.assetTag}</span>
                        <span className="truncate">{a.name}</span>
                        {a.type && <span className="text-xs text-muted-foreground capitalize ml-auto shrink-0">{a.type.replace(/_/g, ' ')}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {assetDropOpen && assetSearch && assets.length === 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border rounded-md shadow-md px-3 py-2 text-sm text-muted-foreground">
                    No assets found
                  </div>
                )}
              </div>
              {errors.assetId && <p className="text-xs text-destructive">{errors.assetId.message}</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Label *</Label>
              <Input placeholder="e.g. Patch Panel, Blank, Cable Mgmt" {...register('label')} />
              {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
            </div>
          )}

          {/* Position */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Start U *</Label>
              <Input type="number" min={1} max={totalU} {...register('startU', { valueAsNumber: true })} />
              {errors.startU && <p className="text-xs text-destructive">{errors.startU.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>End U *</Label>
              <Input type="number" min={startU || 1} max={totalU} {...register('endU', { valueAsNumber: true })} />
              {errors.endU && <p className="text-xs text-destructive">{errors.endU.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Face *</Label>
              <Select value={face ?? 'both'} onValueChange={(v) => setValue('face', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both</SelectItem>
                  <SelectItem value="front">Front</SelectItem>
                  <SelectItem value="back">Back</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            {totalU}U rack. "Both" = full-depth device. "Front"/"Back" = half-depth, allows different device on opposite face.
          </p>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} placeholder="Optional notes..." {...register('notes')} />
          </div>

          {mutError && (
            <p className="text-xs text-destructive">
              {(mutError as any)?.response?.data?.error ?? 'Failed to save mount'}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : editing ? 'Save Changes' : 'Mount Device'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Rack diagram ──────────────────────────────────────────────────────────────

function MountCell({
  mount, isAdmin, onEdit, onRemove, colSpan = 1,
}: {
  mount: RackMountResponse;
  isAdmin: boolean;
  onEdit: (m: RackMountResponse) => void;
  onRemove: (m: RackMountResponse) => void;
  colSpan?: number;
}) {
  const navigate = useNavigate();
  const label = mount.asset ? `${mount.asset.assetTag} — ${mount.asset.name}` : (mount.label ?? '');
  const ip = mount.asset?.specs?.ipAddress || mount.asset?.network?.ipAddress;
  const colour = typeColour(mount.asset?.type);
  const span = mount.endU - mount.startU + 1;

  return (
    <td
      rowSpan={span}
      colSpan={colSpan}
      className={`px-2 border-b border-muted/50 align-middle cursor-pointer group ${colour} border`}
      style={{ height: `${span * 28}px` }}
      onClick={() => mount.asset && navigate(`/assets/${mount.asset.id}`)}
    >
      <div className="flex items-center justify-between gap-1 py-0.5">
        <div className="min-w-0">
          <div className="font-medium text-xs truncate leading-tight">{label}</div>
          <div className="flex items-center gap-2 text-xs opacity-75 leading-tight">
            {mount.asset?.type && <span className="capitalize">{mount.asset.type.replace(/_/g, ' ')}</span>}
            {ip && <span className="font-mono">{ip}</span>}
            {span > 1 && <span>U{mount.startU}–{mount.endU}</span>}
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
            <button className="rounded p-0.5 hover:bg-white/20" onClick={() => onEdit(mount)}>
              <Pencil className="h-2.5 w-2.5" />
            </button>
            <button className="rounded p-0.5 hover:bg-white/20" onClick={() => onRemove(mount)}>
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        )}
      </div>
    </td>
  );
}

function EmptyCell({ u, face, isAdmin, onClick }: {
  u: number;
  face: 'front' | 'back' | 'both';
  isAdmin: boolean;
  onClick: (u: number, face: 'front' | 'back' | 'both') => void;
}) {
  return (
    <td
      colSpan={face === 'both' ? 2 : 1}
      className={`border-b border-muted/30 h-7 ${isAdmin ? 'cursor-pointer hover:bg-slate-700/50 group' : ''}`}
      onClick={() => isAdmin && onClick(u, face)}
    >
      {isAdmin && (
        <span className="hidden group-hover:inline-flex items-center gap-1 px-2 text-xs text-slate-400">
          <Plus className="h-2.5 w-2.5" />
          {face === 'both' ? `U${u}` : `U${u} ${face}`}
        </span>
      )}
    </td>
  );
}

function RackDiagram({
  rack, isAdmin, onClickEmpty, onEdit, onRemove,
}: {
  rack: RackResponse;
  isAdmin: boolean;
  onClickEmpty: (u: number, face: 'front' | 'back' | 'both') => void;
  onEdit: (mount: RackMountResponse) => void;
  onRemove: (mount: RackMountResponse) => void;
}) {
  // Index mounts by face and startU
  const frontByU = new Map<number, RackMountResponse>();
  const backByU = new Map<number, RackMountResponse>();

  // Track which U rows have cells already emitted via rowspan
  const frontCovered = new Set<number>();
  const backCovered = new Set<number>();

  for (const m of rack.mounts) {
    const face = m.face ?? 'both';
    if (face === 'front' || face === 'both') frontByU.set(m.startU, m);
    if (face === 'back'  || face === 'both') backByU.set(m.startU, m);
    // Mark rows covered by rowspan (all rows after startU)
    for (let u = m.startU + 1; u <= m.endU; u++) {
      if (face === 'front' || face === 'both') frontCovered.add(u);
      if (face === 'back'  || face === 'both') backCovered.add(u);
    }
  }

  const rows: React.ReactNode[] = [];

  for (let u = 1; u <= rack.totalU; u++) {
    const fm = frontByU.get(u);
    const bm = backByU.get(u);
    const fc = frontCovered.has(u);
    const bc = backCovered.has(u);

    // If both front and back are covered by rowspan, skip this row entirely
    if (fc && bc) continue;

    // Determine if both columns have the same 'both' mount starting here
    const isBothMount = fm && bm && fm.id === bm.id;

    rows.push(
      <tr key={u}>
        {/* U number — only show if not fully covered */}
        <td className="w-8 text-center text-xs text-slate-500 font-mono border-r border-slate-700 select-none align-middle py-0">
          {u}
        </td>

        {isBothMount ? (
          // Single full-depth device spanning both columns
          <MountCell mount={fm!} isAdmin={isAdmin} onEdit={onEdit} onRemove={onRemove} colSpan={2} />
        ) : (
          <>
            {/* Front column */}
            {!fc && (
              fm
                ? <MountCell mount={fm} isAdmin={isAdmin} onEdit={onEdit} onRemove={onRemove} />
                : <EmptyCell u={u} face="front" isAdmin={isAdmin} onClick={onClickEmpty} />
            )}
            {/* Back column */}
            {!bc && (
              bm
                ? <MountCell mount={bm} isAdmin={isAdmin} onEdit={onEdit} onRemove={onRemove} />
                : <EmptyCell u={u} face="back" isAdmin={isAdmin} onClick={onClickEmpty} />
            )}
          </>
        )}
      </tr>,
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
          <span className="text-sm font-medium text-slate-200">{rack.name}</span>
        </div>
        <span className="text-xs text-slate-400 font-mono">{rack.totalU}U</span>
      </div>

      {/* Column headers */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-800/60 border-b border-slate-700">
            <th className="w-8 text-xs text-slate-500 font-normal py-1 border-r border-slate-700">U</th>
            <th className="text-xs text-slate-400 font-medium py-1 w-1/2 border-r border-slate-700/50">FRONT</th>
            <th className="text-xs text-slate-400 font-medium py-1 w-1/2">BACK</th>
          </tr>
        </thead>
      </table>

      {/* U rows */}
      <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-8" />
            <col className="w-[46%]" />
            <col className="w-[46%]" />
          </colgroup>
          <tbody>{rows}</tbody>
        </table>
      </div>

      <div className="bg-slate-800 border-t border-slate-700 h-4" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function RackDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const [modalOpen, setModalOpen] = useState(false);
  const [preStartU, setPreStartU] = useState<number | undefined>();
  const [preFace, setPreFace] = useState<'front' | 'back' | 'both'>('both');
  const [editingMount, setEditingMount] = useState<RackMountResponse | undefined>();

  const { data: rack, isLoading } = useQuery({
    queryKey: ['racks', id],
    queryFn: () => getRack(id!),
    enabled: !!id,
  });

  const { mutate: doRemove } = useMutation({
    mutationFn: ({ mountId }: { mountId: string }) => removeMount(id!, mountId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['racks', id] }),
  });

  function openEmpty(u: number, face: 'front' | 'back' | 'both') {
    setEditingMount(undefined);
    setPreStartU(u);
    setPreFace(face);
    setModalOpen(true);
  }

  function openEdit(mount: RackMountResponse) {
    setEditingMount(mount);
    setPreStartU(undefined);
    setModalOpen(true);
  }

  function handleRemove(mount: RackMountResponse) {
    const label = mount.asset ? mount.asset.name : (mount.label ?? 'this device');
    if (confirm(`Remove "${label}" from the rack?`)) {
      doRemove({ mountId: mount.id });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rack) return <div>Rack not found.</div>;

  // Count unique U positions used (front+back at same U = 1 used U)
  const usedUSet = new Set<number>();
  for (const m of rack.mounts) {
    for (let u = m.startU; u <= m.endU; u++) usedUSet.add(u);
  }
  const usedU = usedUSet.size;

  return (
    <div className="space-y-4 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/network/racks')} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to racks
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-muted-foreground">{rack.location}</p>
          <h1 className="text-xl font-bold mt-0.5">{rack.name}</h1>
          <p className="text-sm text-muted-foreground">
            {rack.totalU}U rack · {usedU}U used · {rack.totalU - usedU}U free
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => { setEditingMount(undefined); setPreStartU(undefined); setPreFace('both'); setModalOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Mount Device
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_COLOURS).map(([type, cls]) => (
          <span key={type} className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border ${cls}`}>
            {type.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      <RackDiagram
        rack={rack}
        isAdmin={isAdmin}
        onClickEmpty={openEmpty}
        onEdit={openEdit}
        onRemove={handleRemove}
      />

      <MountModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingMount(undefined); setPreStartU(undefined); }}
        rackId={id!}
        totalU={rack.totalU}
        preStartU={preStartU}
        preFace={preFace}
        editing={editingMount}
      />
    </div>
  );
}
