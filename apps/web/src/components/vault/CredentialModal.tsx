import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { createCredential, updateCredential } from '@/api/vault';
import { getAssets } from '@/api/assets';
import { getUsers } from '@/api/users';
import { getVendors } from '@/api/vendors';
import { CreateCredentialSchema, CredentialCategory, VaultAccessLevel, type CreateCredentialInput, type CredentialResponse } from '@itdesk/shared';

// Password is optional in this form schema — we validate it manually for create mode
// so that editing without changing the password doesn't block submission.
const CredentialFormSchema = CreateCredentialSchema.extend({ password: z.string().optional() });
type CredentialFormValues = z.infer<typeof CredentialFormSchema>;

const CATEGORY_LABELS: Record<string, string> = {
  service_account: 'Service Account',
  device: 'Device',
  shared_account: 'Shared Account',
  api_key: 'API Key',
  other: 'Other',
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: CredentialResponse;
  /** Pre-select an asset in the linked asset dropdown */
  preLinkedAssetId?: string;
  /** Pre-select a vendor in the linked vendor dropdown */
  preLinkedVendorId?: string;
}

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  staff: 'All Staff (techs, admins)',
  admin: 'Admins Only',
  restricted: 'Specific Users',
};

export function CredentialModal({ open, onClose, editing, preLinkedAssetId, preLinkedVendorId }: Props) {
  const queryClient = useQueryClient();
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>(
    editing?.allowedUsers?.map((u) => u.id) ?? [],
  );

  const { data: assetsData } = useQuery({
    queryKey: ['assets', 'all'],
    queryFn: () => getAssets({ limit: 100 }),
  });
  const assets: Array<{ id: string; name: string; assetTag: string }> = assetsData?.data ?? [];

  const { data: vendorsData = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => getVendors(),
  });
  const vendors: Array<{ id: string; name: string }> = vendorsData as any[];

  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => getUsers({ limit: 200 }),
  });
  const allUsers: Array<{ id: string; displayName: string; email: string }> = usersData?.data ?? [];

  const { register, handleSubmit, setValue, reset, control, setError, formState: { errors } } = useForm<CredentialFormValues>({
    resolver: zodResolver(CredentialFormSchema),
    defaultValues: editing
      ? {
          title: editing.title,
          username: editing.username ?? '',
          password: '',
          url: editing.url ?? '',
          notes: editing.notes ?? '',
          category: editing.category as CredentialFormValues['category'],
          linkedAsset: editing.linkedAsset?.id ?? preLinkedAssetId ?? '',
          linkedVendor: (editing as any).linkedVendor?.id ?? preLinkedVendorId ?? '',
          tags: editing.tags,
          accessLevel: (editing.accessLevel ?? VaultAccessLevel.STAFF) as CredentialFormValues['accessLevel'],
          allowedUsers: editing.allowedUsers?.map((u) => u.id) ?? [],
        }
      : {
          category: CredentialCategory.OTHER,
          tags: [],
          linkedAsset: preLinkedAssetId ?? '',
          linkedVendor: preLinkedVendorId ?? '',
          accessLevel: VaultAccessLevel.STAFF,
          allowedUsers: [],
        },
  });

  // Re-populate the form whenever the credential being edited changes
  useEffect(() => {
    if (editing) {
      reset({
        title: editing.title,
        username: editing.username ?? '',
        password: '',
        url: editing.url ?? '',
        notes: editing.notes ?? '',
        category: editing.category as CredentialFormValues['category'],
        linkedAsset: editing.linkedAsset?.id ?? preLinkedAssetId ?? '',
        linkedVendor: (editing as any).linkedVendor?.id ?? preLinkedVendorId ?? '',
        tags: editing.tags,
        accessLevel: (editing.accessLevel ?? VaultAccessLevel.STAFF) as CredentialFormValues['accessLevel'],
        allowedUsers: editing.allowedUsers?.map((u) => u.id) ?? [],
      });
      setAllowedUserIds(editing.allowedUsers?.map((u) => u.id) ?? []);
    } else {
      reset({
        category: CredentialCategory.OTHER,
        tags: [],
        linkedAsset: preLinkedAssetId ?? '',
        linkedVendor: preLinkedVendorId ?? '',
        accessLevel: VaultAccessLevel.STAFF,
        allowedUsers: [],
      });
      setAllowedUserIds([]);
    }
  }, [editing?.id]);

  const accessLevel = useWatch({ control, name: 'accessLevel' });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CredentialFormValues) => {
      // When editing, omit empty password so the server keeps the existing one
      const payload: any = { ...data, allowedUsers: allowedUserIds };
      if (editing && !payload.password) delete payload.password;
      return editing ? updateCredential(editing.id, payload) : createCredential(payload as CreateCredentialInput);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
      reset();
      setAllowedUserIds([]);
      onClose();
    },
  });

  function toggleUser(id: string) {
    setAllowedUserIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const defaultAssetValue = editing?.linkedAsset?.id ?? preLinkedAssetId ?? 'none';
  const defaultVendorValue = (editing as any)?.linkedVendor?.id ?? preLinkedVendorId ?? 'none';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Credential' : 'Add Credential'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => {
          if (!editing && !d.password) {
            setError('password', { message: 'Password is required' });
            return;
          }
          mutate(d);
        })} className="space-y-4">
          <Field label="Title *" error={errors.title?.message}>
            <Input placeholder="e.g. iDRAC Admin, Switch Management" {...register('title')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category">
              <Select
                defaultValue={editing?.category ?? CredentialCategory.OTHER}
                onValueChange={(v) => setValue('category', v as CreateCredentialInput['category'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Linked Asset">
              <Select
                defaultValue={defaultAssetValue}
                onValueChange={(v) => setValue('linkedAsset', v === 'none' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.assetTag} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Linked Vendor">
            <Select
              defaultValue={defaultVendorValue}
              onValueChange={(v) => setValue('linkedVendor' as any, v === 'none' ? '' : v)}
            >
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Username / Account">
            <Input placeholder="e.g. root, admin" {...register('username')} />
          </Field>

          <Field label={editing ? 'Password (leave blank to keep current)' : 'Password *'} error={errors.password?.message}>
            <Input type="password" placeholder="••••••••" {...register('password')} />
          </Field>

          <Field label="URL">
            <Input placeholder="e.g. https://192.168.1.1" {...register('url')} />
          </Field>

          <Field label="Notes">
            <Textarea rows={3} placeholder="e.g. iDRAC management interface for rack unit 3" {...register('notes')} />
          </Field>

          <Field label="Access Level">
            <Select
              defaultValue={editing?.accessLevel ?? VaultAccessLevel.STAFF}
              onValueChange={(v) => setValue('accessLevel', v as CreateCredentialInput['accessLevel'])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ACCESS_LEVEL_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {accessLevel === VaultAccessLevel.RESTRICTED && (
            <Field label="Allowed Users">
              <div className="border rounded max-h-40 overflow-y-auto divide-y">
                {allUsers.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">No users found.</p>
                )}
                {allUsers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={allowedUserIds.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                    />
                    <span className="flex-1">{u.displayName}</span>
                    <span className="text-xs text-muted-foreground">{u.email}</span>
                  </label>
                ))}
              </div>
              {allowedUserIds.length > 0 && (
                <p className="text-xs text-muted-foreground">{allowedUserIds.length} user{allowedUserIds.length !== 1 ? 's' : ''} selected</p>
              )}
            </Field>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Credential'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
