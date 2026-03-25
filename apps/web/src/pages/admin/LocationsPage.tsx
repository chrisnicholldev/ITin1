import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getLocations, createLocation, updateLocation, deleteLocation } from '@/api/locations';
import { type LocationResponse } from '@itdesk/shared';

function LocationModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: LocationResponse }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [shortCode, setShortCode] = useState(editing?.shortCode ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () => editing
      ? updateLocation(editing.id, { name, shortCode: shortCode || undefined, address: address || undefined, notes: notes || undefined })
      : createLocation({ name, shortCode: shortCode || undefined, address: address || undefined, notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      onClose();
    },
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Failed to save location'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Location' : 'New Location'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Head Office" />
          </div>
          <div className="space-y-1.5">
            <Label>Short Code</Label>
            <Input value={shortCode} onChange={(e) => setShortCode(e.target.value)} placeholder="e.g. HQ" maxLength={10} />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
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

export function LocationsPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LocationResponse | undefined>();

  const { data: locations = [] } = useQuery<LocationResponse[]>({
    queryKey: ['locations'],
    queryFn: getLocations,
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['locations'] }),
    onError: (e: any) => alert(e?.response?.data?.message ?? 'Could not delete location'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Physical sites and offices</p>
        </div>
        <Button onClick={() => { setEditing(undefined); setModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-1.5" /> New Location
        </Button>
      </div>

      {locations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No locations yet.
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => { setEditing(undefined); setModalOpen(true); }}>
                Add your first location
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((loc) => (
            <Card key={loc.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {loc.name}
                  {loc.shortCode && (
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{loc.shortCode}</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {loc.address && <p className="text-sm text-muted-foreground">{loc.address}</p>}
                {loc.notes && <p className="text-xs text-muted-foreground">{loc.notes}</p>}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="h-7" onClick={() => { setEditing(loc); setModalOpen(true); }}>
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 hover:text-destructive hover:border-destructive"
                    onClick={() => { if (confirm(`Delete "${loc.name}"?`)) doDelete(loc.id); }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <LocationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(undefined); }}
        editing={editing}
      />
    </div>
  );
}
