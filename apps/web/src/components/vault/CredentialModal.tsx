import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { createCredential, updateCredential } from '@/api/vault';
import { getAssets } from '@/api/assets';
import { CreateCredentialSchema, CredentialCategory, type CreateCredentialInput, type CredentialResponse } from '@itdesk/shared';

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
}

export function CredentialModal({ open, onClose, editing, preLinkedAssetId }: Props) {
  const queryClient = useQueryClient();

  const { data: assetsData } = useQuery({
    queryKey: ['assets', 'all'],
    queryFn: () => getAssets({ limit: 100 }),
  });
  const assets: Array<{ id: string; name: string; assetTag: string }> = assetsData?.data ?? [];

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CreateCredentialInput>({
    resolver: zodResolver(CreateCredentialSchema),
    defaultValues: editing
      ? {
          title: editing.title,
          username: editing.username ?? '',
          password: '',
          url: editing.url ?? '',
          notes: editing.notes ?? '',
          category: editing.category as CreateCredentialInput['category'],
          linkedAsset: editing.linkedAsset?.id ?? preLinkedAssetId ?? '',
          tags: editing.tags,
        }
      : {
          category: CredentialCategory.OTHER,
          tags: [],
          linkedAsset: preLinkedAssetId ?? '',
        },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: CreateCredentialInput) =>
      editing ? updateCredential(editing.id, data) : createCredential(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
      reset();
      onClose();
    },
  });

  const defaultAssetValue = editing?.linkedAsset?.id ?? preLinkedAssetId ?? 'none';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Credential' : 'Add Credential'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
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
