import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createTicket } from '@/api/tickets';
import { getEntraUsers } from '@/api/users';
import { apiClient } from '@/api/client';
import { useAuthStore } from '@/stores/auth.store';
import { CreateTicketSchema, TicketPriority, type CreateTicketInput } from '@itdesk/shared';

const TECH_ROLES = new Set(['it_technician', 'it_admin', 'super_admin']);

type EntraUser = { graphId: string; displayName: string; email: string };

export function CreateTicketPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isTech = TECH_ROLES.has(currentUser?.role ?? '');

  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<EntraUser | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await apiClient.get('/categories');
      return data as Array<{ id: string; name: string; subcategories: string[] }>;
    },
  });

  const { data: entraUsers = [] } = useQuery<EntraUser[]>({
    queryKey: ['entra-users', userSearch],
    queryFn: () => getEntraUsers(userSearch),
    enabled: isTech && userSearch.length >= 2,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(CreateTicketSchema),
    defaultValues: { priority: TicketPriority.MEDIUM, relatedAssets: [], tags: [] },
  });

  const selectedCategory = watch('category');
  const selectedCategoryData = categories.find((c) => c.id === selectedCategory);

  const { mutate, isPending, error } = useMutation({
    mutationFn: (data: CreateTicketInput) => createTicket({
      ...data,
      ...(isTech && selectedUser ? {
        submittedForAzureId: selectedUser.graphId,
        submittedForName: selectedUser.displayName,
        submittedForEmail: selectedUser.email,
      } : {}),
    }),
    onSuccess: (ticket: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      navigate(`/tickets/${ticket.id}`);
    },
  });

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold">New Ticket</h1>
        <p className="text-sm text-muted-foreground">Submit a request for IT support</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">

            {isTech && (
              <div className="space-y-2">
                <Label>Submitted for</Label>
                {selectedUser ? (
                  <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <span className="flex-1">
                      {selectedUser.displayName}
                      <span className="ml-2 text-muted-foreground text-xs">{selectedUser.email}</span>
                    </span>
                    <button type="button" onClick={() => { setSelectedUser(null); setUserSearch(''); }}>
                      <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Search by name or email…"
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                      onFocus={() => setShowUserDropdown(true)}
                      onBlur={() => setTimeout(() => setShowUserDropdown(false), 150)}
                    />
                    {showUserDropdown && userSearch.length >= 2 && entraUsers.length > 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-white shadow-md overflow-hidden">
                        {entraUsers.map((u) => (
                          <button
                            key={u.graphId}
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                            onMouseDown={() => { setSelectedUser(u); setShowUserDropdown(false); setUserSearch(''); }}
                          >
                            <span className="font-medium">{u.displayName}</span>
                            <span className="ml-2 text-muted-foreground text-xs">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Leave blank to submit as yourself.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief summary of the issue"
                {...register('title')}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select onValueChange={(v) => { setValue('category', v); setValue('subcategory', ''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select defaultValue={TicketPriority.MEDIUM} onValueChange={(v) => setValue('priority', v as typeof TicketPriority[keyof typeof TicketPriority])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TicketPriority).map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedCategoryData && selectedCategoryData.subcategories.length > 0 && (
              <div className="space-y-2">
                <Label>Subcategory</Label>
                <Select onValueChange={(v) => setValue('subcategory', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCategoryData.subcategories.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <textarea
                id="description"
                rows={6}
                placeholder="Describe the issue in detail. Include steps to reproduce, error messages, affected devices, etc."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                {...register('description')}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">Failed to submit ticket. Please try again.</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Ticket
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
