import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTicket, updateTicket, addComment } from '@/api/tickets';
import { useAuthStore } from '@/stores/auth.store';
import { TicketStatus, TicketPriority, UserRole } from '@itdesk/shared';

const priorityVariant: Record<string, string> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isTech = user?.role !== UserRole.END_USER;

  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => getTicket(id!),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof updateTicket>[1]) => updateTicket(id!, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets', id] }),
  });

  const commentMutation = useMutation({
    mutationFn: () => addComment(id!, { body: comment, isInternal }),
    onSuccess: () => {
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['tickets', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) return <div>Ticket not found.</div>;

  return (
    <div className="max-w-3xl space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate('/tickets')} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Back to tickets
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</p>
          <h1 className="text-xl font-bold mt-0.5">{ticket.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submitted by {ticket.submittedBy?.displayName} ·{' '}
            {new Date(ticket.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={(priorityVariant[ticket.priority] as 'destructive') ?? 'secondary'}>
            {ticket.priority}
          </Badge>
          <Badge>{ticket.status.replace('_', ' ')}</Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Main content */}
        <div className="md:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Comments ({ticket.comments?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticket.comments?.map(
                (c: {
                  id: string;
                  author: { displayName: string };
                  body: string;
                  isInternal: boolean;
                  createdAt: string;
                }) => (
                  <div
                    key={c.id}
                    className={`rounded-md p-3 text-sm ${
                      c.isInternal ? 'bg-yellow-50 border border-yellow-200' : 'bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{c.author?.displayName}</span>
                      <div className="flex items-center gap-2">
                        {c.isInternal && (
                          <Badge variant="warning" className="text-xs">internal</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap">{c.body}</p>
                  </div>
                ),
              )}

              {/* Add comment */}
              <div className="space-y-2 pt-2 border-t">
                <textarea
                  rows={3}
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
                <div className="flex items-center justify-between">
                  {isTech && (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isInternal}
                        onChange={(e) => setIsInternal(e.target.checked)}
                      />
                      Internal note (hidden from end users)
                    </label>
                  )}
                  <Button
                    size="sm"
                    disabled={!comment.trim() || commentMutation.isPending}
                    onClick={() => commentMutation.mutate()}
                    className="ml-auto gap-2"
                  >
                    {commentMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    Post
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {isTech && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Manage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select
                    defaultValue={ticket.status}
                    onValueChange={(v) => updateMutation.mutate({ status: v as typeof TicketStatus[keyof typeof TicketStatus] })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TicketStatus).map((s) => (
                        <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Priority</p>
                  <Select
                    defaultValue={ticket.priority}
                    onValueChange={(v) => updateMutation.mutate({ priority: v as typeof TicketPriority[keyof typeof TicketPriority] })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TicketPriority).map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Category</span>
                <span>{ticket.category?.name}</span>
              </div>
              {ticket.assignedTo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned to</span>
                  <span>{ticket.assignedTo.displayName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
              {ticket.resolvedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved</span>
                  <span>{new Date(ticket.resolvedAt).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
