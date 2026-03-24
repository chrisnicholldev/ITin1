import { useState } from 'react';
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

// ── Type colour map ───────────────────────────────────────────────────────────

const TYPE_COLOURS: Record<string, string> = {
  server:         'bg-blue-600 border-blue-700 text-white',
  switch:         'bg-green-600 border-green-700 text-white',
  router:         'bg-purple-600 border-purple-700 text-white',
  firewall:       'bg-red-600 border-red-700 text-white',
  access_point:   'bg-yellow-500 border-yellow-600 text-white',
  patch_panel:    'bg-gray-500 border-gray-600 text-white',
  other:          'bg-slate-500 border-slate-600 text-white',
};

function typeColour(type?: string) {
  return TYPE_COLOURS[type ?? 'other'] ?? TYPE_COLOURS['other'];
}

// ── Mount modal ───────────────────────────────────────────────────────────────

function MountModal({
  open, onClose, rackId, totalU, preStartU, editing,
}: {
  open: boolean;
  onClose: () => void;
  rackId: string;
  totalU: number;
  preStartU?: number;
  editing?: RackMountResponse;
}) {
  const queryClient = useQueryClient();

  const { data: assetsData } = useQuery({
    queryKey: ['assets', 'all'],
    queryFn: () => getAssets({ limit: 200 }),
  });
  const assets: any[] = assetsData?.data ?? [];

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<CreateRackMountInput>({
    resolver: zodResolver(CreateRackMountSchema),
    defaultValues: editing
      ? { assetId: editing.asset?.id, label: editing.label, startU: editing.startU, endU: editing.endU, notes: editing.notes ?? '' }
      : { startU: preStartU ?? 1, endU: preStartU ?? 1, notes: '' },
  });

  const startU = watch('startU');

  const { mutate, isPending, error: mutError } = useMutation({
    mutationFn: (data: CreateRackMountInput) =>
      editing
        ? updateMount(rackId, editing.id, { startU: data.startU, endU: data.endU, label: data.label, notes: data.notes })
        : addMount(rackId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['racks', rackId] });
      onClose();
    },
  });

  const [useAsset, setUseAsset] = useState(!editing?.label || !!editing?.asset);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Mount' : 'Mount Device'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">

          {/* Asset or label toggle */}
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={useAsset ? 'default' : 'outline'} onClick={() => setUseAsset(true)}>
              Asset
            </Button>
            <Button type="button" size="sm" variant={!useAsset ? 'default' : 'outline'} onClick={() => setUseAsset(false)}>
              Label only
            </Button>
          </div>

          {useAsset ? (
            <div className="space-y-1.5">
              <Label>Asset *</Label>
              <Select
                defaultValue={editing?.asset?.id ?? ''}
                onValueChange={(v) => setValue('assetId', v)}
              >
                <SelectTrigger><SelectValue placeholder="Select asset..." /></SelectTrigger>
                <SelectContent>
                  {assets.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.assetTag} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.assetId && <p className="text-xs text-destructive">{errors.assetId.message}</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Label *</Label>
              <Input placeholder="e.g. Patch Panel, Blank, Cable Mgmt" {...register('label')} />
              {errors.label && <p className="text-xs text-destructive">{errors.label.message}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Start U *</Label>
              <Input
                type="number"
                min={1}
                max={totalU}
                {...register('startU', { valueAsNumber: true })}
              />
              {errors.startU && <p className="text-xs text-destructive">{errors.startU.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>End U *</Label>
              <Input
                type="number"
                min={startU || 1}
                max={totalU}
                {...register('endU', { valueAsNumber: true })}
              />
              {errors.endU && <p className="text-xs text-destructive">{errors.endU.message}</p>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Rack is {totalU}U total. Size = End U − Start U + 1.
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

function RackDiagram({
  rack, isAdmin, onClickEmpty, onEdit, onRemove,
}: {
  rack: RackResponse;
  isAdmin: boolean;
  onClickEmpty: (u: number) => void;
  onEdit: (mount: RackMountResponse) => void;
  onRemove: (mount: RackMountResponse) => void;
}) {
  const navigate = useNavigate();

  // Build a map: uPosition → mount (only for startU row)
  const mountByStart = new Map<number, RackMountResponse>();
  const occupiedUs = new Set<number>();

  for (const m of rack.mounts) {
    mountByStart.set(m.startU, m);
    for (let u = m.startU; u <= m.endU; u++) occupiedUs.add(u);
  }

  const rows: React.ReactNode[] = [];

  for (let u = 1; u <= rack.totalU; u++) {
    if (occupiedUs.has(u) && !mountByStart.has(u)) continue; // covered by a rowspan

    const mount = mountByStart.get(u);
    const span = mount ? mount.endU - mount.startU + 1 : 1;

    if (mount) {
      const label = mount.asset
        ? `${mount.asset.assetTag} — ${mount.asset.name}`
        : (mount.label ?? '');
      const ip = mount.asset?.specs?.ipAddress || mount.asset?.network?.ipAddress;
      const colour = typeColour(mount.asset?.type);

      rows.push(
        <tr key={u}>
          {/* U number column */}
          <td className="w-10 text-center text-xs text-muted-foreground font-mono border-r border-muted py-0 select-none align-middle">
            {u}
          </td>
          {/* Device cell spanning multiple rows */}
          <td
            rowSpan={span}
            className={`px-3 border-b border-muted/50 align-middle cursor-pointer group ${colour} border`}
            style={{ height: `${span * 28}px` }}
            onClick={() => mount.asset && navigate(`/assets/${mount.asset.id}`)}
          >
            <div className="flex items-center justify-between gap-2 py-1">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{label}</div>
                <div className="flex items-center gap-3 text-xs opacity-80">
                  {mount.asset?.type && <span className="capitalize">{mount.asset.type.replace(/_/g, ' ')}</span>}
                  {ip && <span className="font-mono">{ip}</span>}
                  {mount.asset?.manufacturer && <span>{mount.asset.manufacturer}</span>}
                  {span > 1 && <span>U{mount.startU}–U{mount.endU}</span>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="rounded p-1 hover:bg-white/20"
                    onClick={() => onEdit(mount)}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    className="rounded p-1 hover:bg-white/20"
                    onClick={() => onRemove(mount)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>,
      );
    } else {
      rows.push(
        <tr
          key={u}
          className={`group ${isAdmin ? 'cursor-pointer hover:bg-muted/40' : ''}`}
          onClick={() => isAdmin && onClickEmpty(u)}
        >
          <td className="w-10 text-center text-xs text-muted-foreground font-mono border-r border-muted select-none">
            {u}
          </td>
          <td className="border-b border-muted/30 h-7">
            {isAdmin && (
              <span className="hidden group-hover:inline-flex items-center gap-1 px-3 text-xs text-muted-foreground">
                <Plus className="h-3 w-3" /> Mount device at U{u}
              </span>
            )}
          </td>
        </tr>,
      );
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
      {/* Rack top */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
          <span className="text-sm font-medium text-slate-200">{rack.name}</span>
        </div>
        <span className="text-xs text-slate-400 font-mono">{rack.totalU}U</span>
      </div>

      {/* U rows */}
      <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
        <table className="w-full border-collapse">
          <tbody>{rows}</tbody>
        </table>
      </div>

      {/* Rack bottom */}
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

  function openEmpty(u: number) {
    setEditingMount(undefined);
    setPreStartU(u);
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

  const usedU = rack.mounts.reduce((sum: number, m: RackMountResponse) => sum + (m.endU - m.startU + 1), 0);

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
          <Button size="sm" onClick={() => { setEditingMount(undefined); setPreStartU(undefined); setModalOpen(true); }} className="gap-1.5">
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

      {rack.mounts.length === 0 && (
        <p className="text-sm text-center text-muted-foreground py-4">
          {isAdmin ? 'Click any U row to mount a device.' : 'No devices mounted yet.'}
        </p>
      )}

      <MountModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingMount(undefined); setPreStartU(undefined); }}
        rackId={id!}
        totalU={rack.totalU}
        preStartU={preStartU}
        editing={editingMount}
      />
    </div>
  );
}
