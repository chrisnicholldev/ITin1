import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus, Pencil, UserX, UserCheck, KeyRound, Search, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  getUsers, createUser, updateUser, deactivateUser, reactivateUser, resetPassword,
} from '@/api/users';
import { CreateUserSchema, UpdateUserSchema, UserRole, type CreateUserInput, type UpdateUserInput } from '@itdesk/shared';
import { useAuthStore } from '@/stores/auth.store';
import { z } from 'zod';

const ROLE_LABELS: Record<string, string> = {
  end_user: 'End User',
  it_technician: 'IT Technician',
  it_admin: 'IT Admin',
  super_admin: 'Super Admin',
};

const ROLE_COLOURS: Record<string, string> = {
  end_user: 'bg-gray-100 text-gray-700',
  it_technician: 'bg-blue-100 text-blue-800',
  it_admin: 'bg-purple-100 text-purple-800',
  super_admin: 'bg-red-100 text-red-800',
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

// ── Create / Edit modal ───────────────────────────────────────────────────────

function UserModal({ open, onClose, editing }: {
  open: boolean;
  onClose: () => void;
  editing?: any;
}) {
  const queryClient = useQueryClient();

  const { register, handleSubmit, setValue, reset, formState: { errors } } = useForm<CreateUserInput>({
    resolver: zodResolver(editing ? UpdateUserSchema : CreateUserSchema),
    defaultValues: editing ? {
      displayName: editing.displayName,
      email: editing.email,
      username: editing.username,
      role: editing.role,
      department: editing.department ?? '',
      title: editing.title ?? '',
      phone: editing.phone ?? '',
    } : { role: UserRole.END_USER },
  });

  const { mutate, isPending, error: mutError } = useMutation({
    mutationFn: (data: CreateUserInput) =>
      editing ? updateUser(editing.id, data as UpdateUserInput) : createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      reset();
      onClose();
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit User' : 'Create User'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutate(d))} className="space-y-4">
          <Field label="Display Name *" error={errors.displayName?.message}>
            <Input placeholder="e.g. Jane Smith" {...register('displayName')} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Username *" error={errors.username?.message}>
              <Input placeholder="e.g. jsmith" {...register('username')} />
            </Field>
            <Field label="Role">
              <Select
                defaultValue={editing?.role ?? UserRole.END_USER}
                onValueChange={(v) => setValue('role', v as CreateUserInput['role'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Email *" error={errors.email?.message}>
            <Input type="email" placeholder="e.g. jane@company.com" {...register('email')} />
          </Field>
          {!editing && (
            <Field label="Password *" error={errors.password?.message}>
              <Input type="password" placeholder="Min 8 characters" {...register('password')} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Department">
              <Input placeholder="e.g. IT, Finance" {...register('department')} />
            </Field>
            <Field label="Job Title">
              <Input placeholder="e.g. Systems Admin" {...register('title')} />
            </Field>
          </div>
          <Field label="Phone">
            <Input placeholder="e.g. +44 7700 900000" {...register('phone')} />
          </Field>

          {mutError && (
            <p className="text-xs text-destructive">
              {(mutError as any)?.response?.data?.error ?? 'Failed to save user'}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : editing ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Reset password modal ──────────────────────────────────────────────────────

function ResetPasswordModal({ open, onClose, user }: {
  open: boolean;
  onClose: () => void;
  user?: any;
}) {
  const ResetSchema = z.object({ password: z.string().min(8), confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<z.infer<typeof ResetSchema>>({
    resolver: zodResolver(ResetSchema),
  });

  const { mutate, isPending, error: mutError } = useMutation({
    mutationFn: ({ password }: { password: string }) => resetPassword(user.id, password),
    onSuccess: () => { reset(); onClose(); },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
        </DialogHeader>
        {user && <p className="text-sm text-muted-foreground -mt-2">Setting new password for <strong>{user.displayName}</strong></p>}
        <form onSubmit={handleSubmit((d) => mutate({ password: d.password }))} className="space-y-4">
          <Field label="New Password" error={errors.password?.message}>
            <Input type="password" placeholder="Min 8 characters" {...register('password')} />
          </Field>
          <Field label="Confirm Password" error={errors.confirm?.message}>
            <Input type="password" placeholder="Repeat password" {...register('confirm')} />
          </Field>
          {mutError && (
            <p className="text-xs text-destructive">
              {(mutError as any)?.response?.data?.error ?? 'Failed to reset password'}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Set Password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [userModal, setUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(undefined);
  const [resetModal, setResetModal] = useState(false);
  const [resetTarget, setResetTarget] = useState<any>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, role: roleFilter }],
    queryFn: () => getUsers({ limit: 100, ...(search && { search }), ...(roleFilter && { role: roleFilter }) }),
  });

  const users: any[] = data?.data ?? [];

  const { mutate: doDeactivate } = useMutation({
    mutationFn: deactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  const { mutate: doReactivate } = useMutation({
    mutationFn: reactivateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  function openEdit(u: any) { setEditingUser(u); setUserModal(true); }
  function openReset(u: any) { setResetTarget(u); setResetModal(true); }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Users
          </h1>
          <p className="text-sm text-muted-foreground">Manage accounts and roles</p>
        </div>
        <Button size="sm" onClick={() => { setEditingUser(undefined); setUserModal(true); }} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email or username..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter || 'all'} onValueChange={(v) => setRoleFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All roles" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal">
            {isLoading ? 'Loading...' : `${data?.meta?.total ?? 0} user${data?.meta?.total !== 1 ? 's' : ''}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {users.length === 0 && !isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Username</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Role</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Department</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Last Login</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 w-28" />
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.displayName}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLOURS[u.role] ?? ''}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {u.department || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit" onClick={() => openEdit(u)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {u.authProvider === 'local' && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Reset password" onClick={() => openReset(u)}>
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {u.id !== currentUser?.id && (
                          u.isActive ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:text-destructive"
                              title="Deactivate"
                              onClick={() => { if (confirm(`Deactivate ${u.displayName}?`)) doDeactivate(u.id); }}
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 hover:text-green-600"
                              title="Reactivate"
                              onClick={() => doReactivate(u.id)}
                            >
                              <UserCheck className="h-3.5 w-3.5" />
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <UserModal
        open={userModal}
        onClose={() => { setUserModal(false); setEditingUser(undefined); }}
        editing={editingUser}
      />
      <ResetPasswordModal
        open={resetModal}
        onClose={() => { setResetModal(false); setResetTarget(undefined); }}
        user={resetTarget}
      />
    </div>
  );
}
