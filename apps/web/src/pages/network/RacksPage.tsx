import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Server, MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { listRacks, createRack, deleteRack } from '@/api/racks';
import { CreateRackSchema, type CreateRackInput } from '@itdesk/shared';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function RacksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const [modalOpen, setModalOpen] = useState(false);

  const { data: racks = [], isLoading } = useQuery({
    queryKey: ['racks'],
    queryFn: listRacks,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateRackInput>({
    resolver: zodResolver(CreateRackSchema),
    defaultValues: { totalU: 42 },
  });

  const { mutate: doCreate, isPending } = useMutation({
    mutationFn: createRack,
    onSuccess: (rack) => {
      queryClient.invalidateQueries({ queryKey: ['racks'] });
      reset();
      setModalOpen(false);
      navigate(`/network/racks/${rack.id}`);
    },
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteRack,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['racks'] }),
  });

  // Group by location
  const grouped = (racks as any[]).reduce<Record<string, any[]>>((acc, r) => {
    (acc[r.location] = acc[r.location] ?? []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6" /> Network Racks
          </h1>
          <p className="text-sm text-muted-foreground">Physical rack inventory</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Rack
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : racks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No racks yet. Add one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([location, locationRacks]) => (
            <div key={location}>
              <div className="flex items-center gap-1.5 mb-3 text-sm font-medium text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {locationRacks.map((rack: any) => {
                  const usePct = Math.round((rack.usedU / rack.totalU) * 100);
                  return (
                    <Card
                      key={rack.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => navigate(`/network/racks/${rack.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-base">{rack.name}</CardTitle>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:text-destructive -mt-1 -mr-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete rack "${rack.name}"? This will remove all mounted devices.`)) {
                                  doDelete(rack.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Capacity</span>
                          <span>{rack.usedU}U / {rack.totalU}U used</span>
                        </div>
                        {/* U fill bar */}
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${usePct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{rack.mountCount} device{rack.mountCount !== 1 ? 's' : ''}</span>
                          <span>{rack.totalU - rack.usedU}U free</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create rack modal */}
      <Dialog open={modalOpen} onOpenChange={(v) => { if (!v) { setModalOpen(false); reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Rack</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => doCreate(d))} className="space-y-4">
            <Field label="Name *" error={errors.name?.message}>
              <Input placeholder="e.g. Rack A, Core Switch Rack" {...register('name')} />
            </Field>
            <Field label="Location *" error={errors.location?.message}>
              <Input placeholder="e.g. Server Room 1, Comms Room B" {...register('location')} />
            </Field>
            <Field label="Size (U) *" error={errors.totalU?.message}>
              <Input type="number" min="1" max="100" {...register('totalU')} />
            </Field>
            <Field label="Notes">
              <Textarea rows={2} placeholder="Any notes about this rack..." {...register('notes')} />
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating...' : 'Create Rack'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
