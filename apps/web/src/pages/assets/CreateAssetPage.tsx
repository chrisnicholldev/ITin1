import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createAsset } from '@/api/assets';
import { getUsers } from '@/api/users';
import { CreateAssetSchema, AssetType, AssetStatus, type CreateAssetInput } from '@itdesk/shared';

const HARDWARE_TYPES = [
  AssetType.WORKSTATION, AssetType.LAPTOP, AssetType.SERVER,
  AssetType.PRINTER, AssetType.PHONE,
];
const NETWORK_TYPES = [
  AssetType.SWITCH, AssetType.ROUTER, AssetType.FIREWALL, AssetType.ACCESS_POINT,
];

function isHardware(type: string) { return (HARDWARE_TYPES as string[]).includes(type); }
function isNetwork(type: string) { return (NETWORK_TYPES as string[]).includes(type); }
function isSoftware(type: string) { return type === AssetType.SOFTWARE_LICENSE; }

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function CreateAssetPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => getUsers({ limit: 100 }),
  });
  const users: Array<{ id: string; displayName: string }> = usersData?.data ?? [];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateAssetInput>({
    resolver: zodResolver(CreateAssetSchema),
    defaultValues: { status: AssetStatus.ACTIVE, customFields: {} },
  });

  const type = watch('type');

  const { mutate, isPending, error } = useMutation({
    mutationFn: createAsset,
    onSuccess: (asset: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      navigate(`/assets/${asset.id}`);
    },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/assets')} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to assets
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Add Asset</h1>
        <p className="text-sm text-muted-foreground">Register a new asset in the inventory</p>
      </div>

      <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">

        {/* Core details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field label="Name *" error={errors.name?.message}>
                <Input placeholder="e.g. Chris's Laptop, Server-01" {...register('name')} />
              </Field>
            </div>

            <Field label="Type *" error={errors.type?.message}>
              <Select onValueChange={(v) => setValue('type', v as CreateAssetInput['type'])}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.values(AssetType).map((t) => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Status">
              <Select defaultValue={AssetStatus.ACTIVE} onValueChange={(v) => setValue('status', v as CreateAssetInput['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.values(AssetStatus).map((s) => (
                    <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Assigned To">
              <Select onValueChange={(v) => setValue('assignedTo', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Location">
              <Input placeholder="e.g. Office 2, Rack A-3" {...register('location')} />
            </Field>

            <Field label="Manufacturer">
              <Input placeholder="e.g. Dell, Apple, Cisco" {...register('manufacturer')} />
            </Field>

            <Field label="Model">
              <Input placeholder="e.g. OptiPlex 7060, MacBook Pro 14" {...register('modelName')} />
            </Field>

            <Field label="Serial Number">
              <Input placeholder="e.g. SN123456" {...register('serialNumber')} />
            </Field>

            <Field label="Purchase Date">
              <Input type="date" {...register('purchaseDate')} />
            </Field>

            <Field label="Warranty Expiry">
              <Input type="date" {...register('warrantyExpiry')} />
            </Field>

            <Field label="Purchase Cost (£)">
              <Input type="number" step="0.01" min="0" placeholder="0.00" {...register('purchaseCost', { valueAsNumber: true })} />
            </Field>
          </CardContent>
        </Card>

        {/* Hardware specs */}
        {type && isHardware(type) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Hardware Specs</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="CPU">
                <Input placeholder="e.g. Intel Core i7-12700" {...register('specs.cpu')} />
              </Field>
              <Field label="RAM">
                <Input placeholder="e.g. 16GB DDR4" {...register('specs.ram')} />
              </Field>
              <Field label="Storage">
                <Input placeholder="e.g. 512GB NVMe SSD" {...register('specs.storage')} />
              </Field>
              <Field label="Operating System">
                <Input placeholder="e.g. Windows 11 Pro" {...register('specs.os')} />
              </Field>
              <Field label="OS Version">
                <Input placeholder="e.g. 23H2" {...register('specs.osVersion')} />
              </Field>
              <Field label="IP Address">
                <Input placeholder="e.g. 192.168.1.50" {...register('specs.ipAddress')} />
              </Field>
              <Field label="MAC Address">
                <Input placeholder="e.g. AA:BB:CC:DD:EE:FF" {...register('specs.macAddress')} />
              </Field>
            </CardContent>
          </Card>
        )}

        {/* Network device fields */}
        {type && isNetwork(type) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Network Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="IP Address">
                <Input placeholder="e.g. 192.168.1.1" {...register('network.ipAddress')} />
              </Field>
              <Field label="MAC Address">
                <Input placeholder="e.g. AA:BB:CC:DD:EE:FF" {...register('network.macAddress')} />
              </Field>
              <Field label="VLAN">
                <Input type="number" placeholder="e.g. 10" {...register('network.vlan', { valueAsNumber: true })} />
              </Field>
              <Field label="Port / Interface">
                <Input placeholder="e.g. Gi0/1, eth0" {...register('network.port')} />
              </Field>
            </CardContent>
          </Card>
        )}

        {/* Software licence */}
        {type && isSoftware(type) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Licence Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Vendor">
                <Input placeholder="e.g. Microsoft, Adobe" {...register('license.vendor')} />
              </Field>
              <Field label="Licence Key">
                <Input placeholder="XXXXX-XXXXX-XXXXX" {...register('license.key')} />
              </Field>
              <Field label="Total Seats">
                <Input type="number" min="1" placeholder="e.g. 25" {...register('license.seats', { valueAsNumber: true })} />
              </Field>
              <Field label="Seats In Use">
                <Input type="number" min="0" placeholder="e.g. 18" {...register('license.seatsUsed', { valueAsNumber: true })} />
              </Field>
              <Field label="Expiry Date">
                <Input type="date" {...register('license.expiryDate')} />
              </Field>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <textarea
              rows={3}
              placeholder="Any additional information about this asset..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              {...register('notes')}
            />
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-sm text-destructive">Failed to create asset. Please try again.</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Asset
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/assets')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
