import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { getCannedResponses, createCannedResponse, updateCannedResponse, deleteCannedResponse } from '@/api/tickets';
import { getCategories } from '@/api/categories';

type CannedResponse = { id: string; _id: string; title: string; body: string; category?: { _id: string; name: string } };

export function CannedResponsesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CannedResponse | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['canned-responses'],
    queryFn: () => getCannedResponses(),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });
  const categories: { id: string; name: string }[] = Array.isArray(categoriesData) ? categoriesData : [];

  function openNew() {
    setEditing(null); setTitle(''); setBody(''); setCategoryId(''); setOpen(true);
  }

  function openEdit(r: CannedResponse) {
    setEditing(r); setTitle(r.title); setBody(r.body); setCategoryId(r.category?._id ?? ''); setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateCannedResponse(editing._id ?? editing.id, { title, body, categoryId: categoryId || undefined })
        : createCannedResponse({ title, body, categoryId: categoryId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canned-responses'] });
      setOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCannedResponse(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['canned-responses'] }),
  });

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Canned Responses</h1>
          <p className="text-sm text-muted-foreground">Reusable comment templates for technicians</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />New Template</Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && responses.length === 0 && (
        <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No templates yet.</CardContent></Card>
      )}

      <div className="space-y-2">
        {(responses as CannedResponse[]).map((r) => (
          <Card key={r._id ?? r.id}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">{r.title}</CardTitle>
                  {r.category && <p className="text-xs text-muted-foreground mt-0.5">{r.category.name}</p>}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(r._id ?? r.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-3 px-4">
              <p className="text-xs text-muted-foreground line-clamp-2">{r.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v) setOpen(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Template name..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Category (optional)</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <textarea
                rows={6}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Template text..."
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              disabled={!title.trim() || !body.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
