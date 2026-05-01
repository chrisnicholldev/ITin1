import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createTicket } from '@/api/tickets';
import { apiClient } from '@/api/client';
import { CreateTicketSchema, TicketPriority, type CreateTicketInput } from '@itdesk/shared';
import { useState } from 'react';

export function TeamsNewTicketPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await apiClient.get('/categories');
      return data as Array<{ id: string; name: string; subcategories: string[] }>;
    },
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<CreateTicketInput>({
    resolver: zodResolver(CreateTicketSchema),
    defaultValues: { priority: TicketPriority.MEDIUM, relatedAssets: [], tags: [] },
  });

  const selectedCategory = watch('category');
  const selectedCategoryData = categories.find((c) => c.id === selectedCategory);

  const { mutate, isPending, error } = useMutation({
    mutationFn: createTicket,
    onSuccess: (ticket: any) => {
      queryClient.invalidateQueries({ queryKey: ['teams-tickets'] });
      setSubmitted(true);
    },
  });

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <div>
          <p className="font-semibold">Ticket submitted</p>
          <p className="text-sm text-muted-foreground mt-1">You'll receive email updates as it progresses.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => { setSubmitted(false); reset(); }}>New ticket</Button>
          <Button variant="outline" onClick={() => navigate('/teams/tickets')}>View my tickets</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((data) => mutate(data))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" placeholder="Brief summary of the issue" {...register('title')} />
        {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Category *</Label>
          <Select onValueChange={(v) => { setValue('category', v); setValue('subcategory', ''); }}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Priority</Label>
          <Select defaultValue={TicketPriority.MEDIUM} onValueChange={(v) => setValue('priority', v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.values(TicketPriority).map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedCategoryData && selectedCategoryData.subcategories.length > 0 && (
        <div className="space-y-1.5">
          <Label>Subcategory</Label>
          <Select onValueChange={(v) => setValue('subcategory', v)}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>
              {selectedCategoryData.subcategories.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="description">Description *</Label>
        <textarea
          id="description"
          rows={5}
          placeholder="Describe the issue in detail…"
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          {...register('description')}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
      </div>

      {error && (
        <p className="text-sm text-destructive">Failed to submit. Please try again.</p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Submit Ticket
      </Button>
    </form>
  );
}
