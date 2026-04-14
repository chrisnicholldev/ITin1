import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, X, Check, Loader2, ExternalLink, Plus, Trash2, KeyRound, Server, User, Globe, Building2, Phone, Mail, QrCode } from 'lucide-react';
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
import { listCredentials, deleteCredential } from '@/api/vault';
import { getMountsByAsset } from '@/api/racks';
import { getNetworks } from '@/api/networks';
import { getVendors } from '@/api/vendors';
import { UpdateAssetSchema, AssetType, AssetStatus, type UpdateAssetInput, type CredentialResponse } from '@itdesk/shared';
import { PasswordCell } from '@/components/vault/PasswordCell';
import { CredentialModal } from '@/components/vault/CredentialModal';
import { printLabels } from '@/lib/printLabels';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

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
  const [credModalOpen, setCredModalOpen] = useState(false);
  const [editingCred, setEditingCred] = useState<CredentialResponse | undefined>();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;

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

  const { data: rackMounts = [] } = useQuery({
    queryKey: ['rack-mounts', 'asset', id],
    queryFn: () => getMountsByAsset(id!),
    enabled: !!id,
  });

  const { data: credentials = [] } = useQuery({
    queryKey: ['vault', 'asset', id],
    queryFn: () => listCredentials(id!),
    enabled: !!id,
  });

  const { data: networks = [] } = useQuery<any[]>({
    queryKey: ['networks'],
    queryFn: () => getNetworks(),
    enabled: editing,
  });

  const { data: vendors = [] } = useQuery<any[]>({
    queryKey: ['vendors'],
    queryFn: () => getVendors(),
    enabled: editing,
  });

  const { mutate: doDeleteCred } = useMutation({
    mutationFn: deleteCredential,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vault'] }),
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
          <Button size="sm" variant="outline"
            onClick={() => printLabels([{ id: asset.id, name: asset.name, assetTag: asset.assetTag, type: asset.type }])}
            className="gap-1.5">
            <QrCode className="w-3.5 h-3.5" /> Print Label
          </Button>
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

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Network</Label>
                <Select
                  defaultValue={(asset as any).linkedNetwork?.id ?? 'none'}
                  onValueChange={(v) => setValue('networkId' as any, v === 'none' ? undefined : v)}
                >
                  <SelectTrigger><SelectValue placeholder="No network" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No network</SelectItem>
                    {networks.map((n: any) => (
                      <SelectItem key={n.id} value={n.id}>
                        {n.name} — {n.address}{n.vlanId ? ` (VLAN ${n.vlanId})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vendor / Supplier</Label>
                <Select
                  defaultValue={(asset as any).vendor?.id ?? 'none'}
                  onValueChange={(v) => setValue('vendorId' as any, v === 'none' ? undefined : v)}
                >
                  <SelectTrigger><SelectValue placeholder="No vendor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No vendor</SelectItem>
                    {vendors.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
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
                <DetailRow label="Device Owner" value={asset.assignedContact?.displayName} />
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

            {asset.externalSource === 'meraki' && asset.customFields && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Meraki Details</CardTitle>
                    {asset.customFields.dashboardUrl && (
                      <a href={asset.customFields.dashboardUrl as string} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs">
                          <ExternalLink className="h-3.5 w-3.5" /> Open in Dashboard
                        </Button>
                      </a>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <DetailRow label="Network" value={asset.customFields.merakiNetworkName as string} />
                  <DetailRow label="Product Type" value={asset.customFields.productType as string} />
                  <DetailRow label="Firmware" value={asset.customFields.firmware as string} />
                  <DetailRow label="Status" value={asset.customFields.merakiStatus as string} />
                  <DetailRow label="Public IP" value={asset.customFields.publicIp as string} />
                  <DetailRow label="Tags" value={asset.customFields.tags as string} />
                  <DetailRow
                    label="Last Reported"
                    value={asset.customFields.lastReportedAt ? new Date(asset.customFields.lastReportedAt as string).toLocaleString() : null}
                  />
                </CardContent>
              </Card>
            )}

            {asset.externalSource === 'intune' && asset.customFields && (
              <Card>
                <CardHeader><CardTitle className="text-base">Azure AD / Intune Details</CardTitle></CardHeader>
                <CardContent>
                  <DetailRow label="Assigned User" value={asset.customFields.assignedUserName as string} />
                  <DetailRow label="User Email" value={asset.customFields.assignedUserEmail as string} />
                  <DetailRow label="UPN" value={asset.customFields.assignedUserUPN as string} />
                  <DetailRow label="Compliant" value={asset.customFields.isCompliant as string} />
                  <DetailRow label="Managed" value={asset.customFields.isManaged as string} />
                  <DetailRow label="Trust Type" value={asset.customFields.trustType as string} />
                  <DetailRow
                    label="Registered"
                    value={asset.customFields.registeredAt ? new Date(asset.customFields.registeredAt as string).toLocaleDateString() : null}
                  />
                  <DetailRow
                    label="Last Sign-in"
                    value={asset.customFields.lastSignIn ? new Date(asset.customFields.lastSignIn as string).toLocaleString() : null}
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
                {asset.lastSyncedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last synced</span>
                    <span>{new Date(asset.lastSyncedAt).toLocaleString()}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Device owner (Azure AD contact) */}
            {asset.assignedContact && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Device Owner
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1.5">
                  <p className="font-medium">{asset.assignedContact.displayName}</p>
                  {asset.assignedContact.jobTitle && (
                    <p className="text-xs text-muted-foreground">{asset.assignedContact.jobTitle}</p>
                  )}
                  {asset.assignedContact.department && (
                    <p className="text-xs text-muted-foreground">{asset.assignedContact.department}</p>
                  )}
                  {asset.assignedContact.email && (
                    <p className="text-xs font-mono text-muted-foreground truncate">{asset.assignedContact.email}</p>
                  )}
                  {asset.assignedContact.upn && asset.assignedContact.upn !== asset.assignedContact.email && (
                    <p className="text-xs font-mono text-muted-foreground truncate">{asset.assignedContact.upn}</p>
                  )}
                </CardContent>
              </Card>
            )}

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

            {/* Rack location */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" /> Rack Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(rackMounts as any[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Not mounted in any rack.</p>
                ) : (
                  (rackMounts as any[]).map((m: any) => (
                    <Link
                      key={m.mountId}
                      to={`/network/racks/${m.rack.id}`}
                      className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 hover:border-primary transition-colors"
                    >
                      <div>
                        <p className="text-xs font-medium">{m.rack.name}</p>
                        <p className="text-xs text-muted-foreground">{m.rack.location} · U{m.startU}{m.endU !== m.startU ? `–U${m.endU}` : ''}</p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Linked network */}
            {(asset as any).linkedNetwork && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Network
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    to={`/network/networks`}
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 hover:border-primary transition-colors"
                  >
                    <div>
                      <p className="text-xs font-medium">{(asset as any).linkedNetwork.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {(asset as any).linkedNetwork.address}
                        {(asset as any).linkedNetwork.vlanId ? ` · VLAN ${(asset as any).linkedNetwork.vlanId}` : ''}
                      </p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Vendor */}
            {(asset as any).vendor && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Vendor
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link
                    to="/vendors"
                    className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 hover:border-primary transition-colors"
                  >
                    <div>
                      <p className="text-xs font-medium">{(asset as any).vendor.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{(asset as any).vendor.type}</p>
                    </div>
                    <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0" />
                  </Link>
                  {(asset as any).vendor.supportPhone && (
                    <a href={`tel:${(asset as any).vendor.supportPhone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                      <Phone className="w-3 h-3" />{(asset as any).vendor.supportPhone}
                    </a>
                  )}
                  {(asset as any).vendor.supportEmail && (
                    <a href={`mailto:${(asset as any).vendor.supportEmail}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
                      <Mail className="w-3 h-3" />{(asset as any).vendor.supportEmail}
                    </a>
                  )}
                  {(asset as any).vendor.contacts?.filter((c: any) => c.isPrimary).map((c: any) => (
                    <div key={c.id} className="rounded-md border bg-muted/30 px-3 py-2">
                      <p className="text-xs font-medium">{c.name}{c.title ? ` · ${c.title}` : ''}</p>
                      {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                      {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Linked credentials */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" /> Credentials
                  </CardTitle>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => { setEditingCred(undefined); setCredModalOpen(true); }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {(credentials as CredentialResponse[]).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No credentials linked.</p>
                ) : (
                  (credentials as CredentialResponse[]).map((c) => (
                    <div key={c.id} className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{c.title}</span>
                        {isAdmin && (
                          <div className="flex gap-0.5 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => { setEditingCred(c); setCredModalOpen(true); }}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:text-destructive"
                              onClick={() => { if (confirm(`Delete "${c.title}"?`)) doDeleteCred(c.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {c.username && (
                        <p className="text-xs text-muted-foreground font-mono">{c.username}</p>
                      )}
                      <PasswordCell id={c.id} />
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                          {c.url}
                        </a>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <CredentialModal
        open={credModalOpen}
        onClose={() => { setCredModalOpen(false); setEditingCred(undefined); }}
        editing={editingCred}
        preLinkedAssetId={id}
      />
    </div>
  );
}
