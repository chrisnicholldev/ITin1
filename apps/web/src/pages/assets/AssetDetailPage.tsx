import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, X, Check, Loader2, ExternalLink } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAsset, updateAsset } from '@/api/assets';
import { getUsers } from '@/api/users';
import { getTickets } from '@/api/tickets';
import { UpdateAssetSchema, AssetType, AssetStatus, type UpdateAssetInput } from '@itdesk/shared';

const statusVariant: Record<string, string> = {
  active: 'success', inactive: 'secondary', decommissioned: 'outline',
  in_repair: 'warning', in_stock: 'info',
};

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] break-all">{String(value)}</span>
    </div>
  );
}

function EditableField({
  label, name, value, register, type = 'text',
}: {
  label: string; name: string; value?: string | number | null;
  register: ReturnType<typeof useForm<UpdateAssetInput>>['register']; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} defaultValue={value ?? ''} {...register(name as keyof UpdateAssetInput)} />
    </div>
  );
}

export function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: asset, isLoading } = useQuery({
    queryKey: ['assets', id],
    queryFn: () => getAsset(id!),
    enabled: !!id,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => getUsers({ limit: 100 }),
  });

  const { data: ticketsData } = useQuery({
    queryKey: ['tickets', { assetId: id }],
    queryFn: () => getTickets({ limit: 10 }),
    enabled: !!id,
  });

  const users: Array<{ id: string; displayName: string }> = usersData?.data ?? [];

  const { register, handleSubmit, setValue } = useForm<UpdateAssetInput>({
    resolver: zodResolver(UpdateAssetSchema),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: UpdateAssetInput) => updateAsset(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets', id] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      setEditing(false);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!asset) return <div>Asset not found.</div>;

  const isHardware = [AssetType.WORKSTATION, AssetType.LAPTOP, AssetType.SERVER, AssetType.PRINTER, AssetType.PHONE].includes(asset.type);
  const isNetwork = [AssetType.SWITCH, AssetType.ROUTER, AssetType.FIREWALL, AssetType.ACCESS_POINT].includes(asset.type);
  const isSoftware = asset.type === AssetType.SOFTWARE_LICENSE;

  return (
    <div className="max-w-4xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/assets')} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to assets
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-mono text-muted-foreground">{asset.assetTag}</p>
          <h1 className="text-xl font-bold mt-0.5">{asset.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {asset.manufacturer && `${asset.manufacturer} `}{asset.modelName && asset.modelName}
            {asset.location && ` · ${asset.location}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{asset.type.replace(/_/g, ' ')}</Badge>
          <Badge variant={(statusVariant[asset.status] as 'default') ?? 'secondary'}>
            {asset.status.replace(/_/g, ' ')}
          </Badge>
          {!editing ? (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
              <X className="w-3.5 h-3.5" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {editing ? (
        /* ── Edit mode ── */
        <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <EditableField label="Name" name="name" value={asset.name} register={register} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select defaultValue={asset.status} onValueChange={(v) => setValue('status', v as UpdateAssetInput['status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(AssetStatus).map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Assigned To</Label>
                <Select
                  defaultValue={asset.assignedTo?.id ?? 'none'}
                  onValueChange={(v) => setValue('assignedTo', v === 'none' ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <EditableField label="Location" name="location" value={asset.location} register={register} />
              <EditableField label="Manufacturer" name="manufacturer" value={asset.manufacturer} register={register} />
              <EditableField label="Model" name="modelName" value={asset.modelName} register={register} />
              <EditableField label="Serial Number" name="serialNumber" value={asset.serialNumber} register={register} />
              <EditableField label="Purchase Date" name="purchaseDate" value={asset.purchaseDate?.split('T')[0]} register={register} type="date" />
              <EditableField label="Warranty Expiry" name="warrantyExpiry" value={asset.warrantyExpiry?.split('T')[0]} register={register} type="date" />
              <EditableField label="Purchase Cost (£)" name="purchaseCost" value={asset.purchaseCost} register={register} type="number" />
            </CardContent>
          </Card>

          {isHardware && (
            <Card>
              <CardHeader><CardTitle className="text-base">Hardware Specs</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="CPU" name="specs.cpu" value={asset.specs?.cpu} register={register} />
                <EditableField label="RAM" name="specs.ram" value={asset.specs?.ram} register={register} />
                <EditableField label="Storage" name="specs.storage" value={asset.specs?.storage} register={register} />
                <EditableField label="OS" name="specs.os" value={asset.specs?.os} register={register} />
                <EditableField label="OS Version" name="specs.osVersion" value={asset.specs?.osVersion} register={register} />
                <EditableField label="IP Address" name="specs.ipAddress" value={asset.specs?.ipAddress} register={register} />
                <EditableField label="MAC Address" name="specs.macAddress" value={asset.specs?.macAddress} register={register} />
              </CardContent>
            </Card>
          )}

          {isNetwork && (
            <Card>
              <CardHeader><CardTitle className="text-base">Network Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="IP Address" name="network.ipAddress" value={asset.network?.ipAddress} register={register} />
                <EditableField label="MAC Address" name="network.macAddress" value={asset.network?.macAddress} register={register} />
                <EditableField label="VLAN" name="network.vlan" value={asset.network?.vlan} register={register} type="number" />
                <EditableField label="Port / Interface" name="network.port" value={asset.network?.port} register={register} />
              </CardContent>
            </Card>
          )}

          {isSoftware && (
            <Card>
              <CardHeader><CardTitle className="text-base">Licence Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditableField label="Vendor" name="license.vendor" value={asset.license?.vendor} register={register} />
                <EditableField label="Licence Key" name="license.key" value={asset.license?.key} register={register} />
                <EditableField label="Total Seats" name="license.seats" value={asset.license?.seats} register={register} type="number" />
                <EditableField label="Seats In Use" name="license.seatsUsed" value={asset.license?.seatsUsed} register={register} type="number" />
                <EditableField label="Expiry Date" name="license.expiryDate" value={asset.license?.expiryDate?.split('T')[0]} register={register} type="date" />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
            <CardContent>
              <textarea
                rows={3}
                defaultValue={asset.notes ?? ''}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                {...register('notes')}
              />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isPending} className="gap-1.5">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save Changes
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </form>
      ) : (
        /* ── View mode ── */
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">

            {/* Core info */}
            <Card>
              <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
              <CardContent>
                <DetailRow label="Asset Tag" value={asset.assetTag} />
                <DetailRow label="Type" value={asset.type.replace(/_/g, ' ')} />
                <DetailRow label="Status" value={asset.status.replace(/_/g, ' ')} />
                <DetailRow label="Manufacturer" value={asset.manufacturer} />
                <DetailRow label="Model" value={asset.modelName} />
                <DetailRow label="Serial Number" value={asset.serialNumber} />
                <DetailRow label="Location" value={asset.location} />
                <DetailRow label="Assigned To" value={asset.assignedTo?.displayName} />
                <DetailRow label="Purchase Date" value={asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString() : null} />
                <DetailRow label="Warranty Expiry" value={asset.warrantyExpiry ? new Date(asset.warrantyExpiry).toLocaleDateString() : null} />
                <DetailRow label="Purchase Cost" value={asset.purchaseCost != null ? `£${asset.purchaseCost.toFixed(2)}` : null} />
              </CardContent>
            </Card>

            {/* Type-specific details */}
            {isHardware && asset.specs && Object.values(asset.specs).some(Boolean) && (
              <Card>
                <CardHeader><CardTitle className="text-base">Hardware Specs</CardTitle></CardHeader>
                <CardContent>
                  <DetailRow label="CPU" value={asset.specs.cpu} />
                  <DetailRow label="RAM" value={asset.specs.ram} />
                  <DetailRow label="Storage" value={asset.specs.storage} />
                  <DetailRow label="OS" value={asset.specs.os} />
                  <DetailRow label="OS Version" value={asset.specs.osVersion} />
                  <DetailRow label="IP Address" value={asset.specs.ipAddress} />
                  <DetailRow label="MAC Address" value={asset.specs.macAddress} />
                </CardContent>
              </Card>
            )}

            {isNetwork && asset.network && Object.values(asset.network).some(Boolean) && (
              <Card>
                <CardHeader><CardTitle className="text-base">Network Details</CardTitle></CardHeader>
                <CardContent>
                  <DetailRow label="IP Address" value={asset.network.ipAddress} />
                  <DetailRow label="MAC Address" value={asset.network.macAddress} />
                  <DetailRow label="VLAN" value={asset.network.vlan} />
                  <DetailRow label="Port / Interface" value={asset.network.port} />
                </CardContent>
              </Card>
            )}

            {isSoftware && asset.license && (
              <Card>
                <CardHeader><CardTitle className="text-base">Licence Details</CardTitle></CardHeader>
                <CardContent>
                  <DetailRow label="Vendor" value={asset.license.vendor} />
                  <DetailRow label="Licence Key" value={asset.license.key} />
                  <DetailRow label="Total Seats" value={asset.license.seats} />
                  <DetailRow label="Seats In Use" value={asset.license.seatsUsed} />
                  <DetailRow
                    label="Expiry Date"
                    value={asset.license.expiryDate ? new Date(asset.license.expiryDate).toLocaleDateString() : null}
                  />
                </CardContent>
              </Card>
            )}

            {asset.notes && (
              <Card>
                <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{asset.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Meta</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Added</span>
                  <span>{new Date(asset.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{new Date(asset.updatedAt).toLocaleDateString()}</span>
                </div>
                {asset.externalSource && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Source</span>
                    <span className="capitalize">{asset.externalSource}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Related tickets */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Recent Tickets</CardTitle></CardHeader>
              <CardContent>
                {ticketsData?.data?.length === 0 && (
                  <p className="text-xs text-muted-foreground">No tickets linked.</p>
                )}
                <div className="space-y-2">
                  {ticketsData?.data?.slice(0, 5).map((t: { id: string; ticketNumber: string; title: string; status: string }) => (
                    <Link
                      key={t.id}
                      to={`/tickets/${t.id}`}
                      className="flex items-center justify-between text-xs hover:text-primary gap-2"
                    >
                      <span className="font-mono text-muted-foreground">{t.ticketNumber}</span>
                      <span className="truncate flex-1">{t.title}</span>
                      <ExternalLink className="w-3 h-3 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
