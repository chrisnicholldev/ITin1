import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Send, X, Paperclip, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTicket, updateTicket, addComment, getTicketHistory, uploadAttachment, deleteAttachment, getCannedResponses } from '@/api/tickets';
import { getAssets } from '@/api/assets';
import { getTeams } from '@/api/teams';
import { useAuthStore } from '@/stores/auth.store';
import { TicketStatus, TicketPriority, UserRole } from '@itdesk/shared';

const priorityVariant: Record<string, string> = {
  critical: 'destructive',
  high: 'warning',
  medium: 'info',
  low: 'secondary',
};

function CannedResponsePicker({ categoryId, onSelect }: { categoryId?: string; onSelect: (body: string) => void }) {
  const [open, setOpen] = useState(false);
  const { data: responses = [] } = useQuery({
    queryKey: ['canned-responses', categoryId],
    queryFn: () => getCannedResponses(categoryId),
    enabled: open,
  });
  return (
    <div className="relative inline-block">
      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setOpen((v) => !v)}>
        Insert template
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 top-8 left-0 bg-white dark:bg-zinc-900 border rounded-md shadow-lg w-72 max-h-64 overflow-y-auto">
            {(responses as Array<{ _id?: string; id?: string; title: string; body: string; category?: { name: string } }>).length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">No templates available.</p>
            )}
            {(responses as Array<{ _id?: string; id?: string; title: string; body: string; category?: { name: string } }>).map((r) => (
              <button
                key={r._id ?? r.id}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b last:border-0"
                onClick={() => { onSelect(r.body); setOpen(false); }}
              >
                <p className="font-medium">{r.title}</p>
                {r.category && <p className="text-muted-foreground">{r.category.name}</p>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isTech = user?.role !== UserRole.END_USER;

  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [assetSearch, setAssetSearch] = useState('');
  const [assetResults, setAssetResults] = useState<{ id: string; name: string; assetTag: string }[]>([]);
  const [showAssetResults, setShowAssetResults] = useState(false);
  const assetSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!assetSearch.trim()) { setAssetResults([]); return; }
    if (assetSearchTimeout.current) clearTimeout(assetSearchTimeout.current);
    assetSearchTimeout.current = setTimeout(async () => {
      const res = await getAssets({ search: assetSearch, limit: 8 });
      setAssetResults(res.data ?? []);
      setShowAssetResults(true);
    }, 300);
  }, [assetSearch]);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['tickets', id],
    queryFn: () => getTicket(id!),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['tickets', id, 'history'],
    queryFn: () => getTicketHistory(id!),
    enabled: !!id,
  });

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
    enabled: isTech,
  });
  const teams: Array<{ id: string; name: string }> = teamsData ?? [];

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

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(id!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets', id] }),
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: (aid: string) => deleteAttachment(id!, aid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets', id] }),
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

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Attachments ({ticket.attachments?.length ?? 0})</span>
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMutation.mutate(file);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    disabled={uploadMutation.isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploadMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
                    Attach
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            {(ticket.attachments?.length ?? 0) > 0 && (
              <CardContent className="space-y-2">
                {ticket.attachments.map((a: { id: string; filename: string; storagePath: string; mimeType: string; size: number; uploadedBy: string }) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm rounded-md border px-3 py-2">
                    <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate">{a.filename}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {(a.size / 1024).toFixed(0)} KB
                    </span>
                    <a href={`/${a.storagePath}`} download={a.filename} className="text-muted-foreground hover:text-foreground">
                      <Download className="w-3 h-3" />
                    </a>
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteAttachmentMutation.mutate(a.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Comments ({ticket.comments?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const allComments: Array<{
                  id: string;
                  author: { displayName: string };
                  body: string;
                  isInternal: boolean;
                  createdAt: string;
                }> = ticket.comments ?? [];
                const LIMIT = 20;
                const visibleComments = showAllComments ? allComments : allComments.slice(-LIMIT);
                return (
                  <>
                    {!showAllComments && allComments.length > LIMIT && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs text-muted-foreground"
                        onClick={() => setShowAllComments(true)}
                      >
                        Load {allComments.length - LIMIT} earlier comments
                      </Button>
                    )}
                    {visibleComments.map((c) => (
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
                    ))}
                  </>
                );
              })()}

              {/* Add comment */}
              <div className="space-y-2 pt-2 border-t">
                {isTech && (
                  <CannedResponsePicker
                    categoryId={ticket.category?.id}
                    onSelect={(body) => setComment((prev) => prev ? prev + '\n\n' + body : body)}
                  />
                )}
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

          {/* History */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {(history as Array<{
                    _id: string;
                    actor: { displayName: string };
                    action: string;
                    changes: Array<{ field: string; from: unknown; to: unknown }>;
                    createdAt: string;
                  }>).map((entry) => (
                    <div key={entry._id} className="flex gap-3 pl-6 relative">
                      <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-background border-2 border-border flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs">
                          <span className="font-medium">{entry.actor?.displayName ?? 'System'}</span>
                          {' · '}
                          <span className="text-muted-foreground capitalize">{entry.action.replace(/_/g, ' ')}</span>
                        </p>
                        {entry.changes?.map((c, i) => (
                          <p key={i} className="text-xs text-muted-foreground mt-0.5">
                            {c.field}: <span className="line-through">{String(c.from || '—')}</span> → <span>{String(c.to || '—')}</span>
                          </p>
                        ))}
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Assigned Team</p>
                  <Select
                    value={(ticket.assignedTeam as any)?.id ?? ticket.assignedTeam ?? 'none'}
                    onValueChange={(v) => updateMutation.mutate({ assignedTeam: v === 'none' ? null : v })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="No team" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No team</SelectItem>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
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
              {ticket.assignedTeam && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Team</span>
                  <span>{(ticket.assignedTeam as any)?.name ?? ticket.assignedTeam}</span>
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Related Assets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(ticket.relatedAssets ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground">No assets linked.</p>
              )}
              {(ticket.relatedAssets ?? []).map((asset: { id: string; name: string; assetTag: string }) => (
                <div key={asset.id} className="flex items-center justify-between text-sm">
                  <Link to={`/assets/${asset.id}`} className="text-primary hover:underline truncate flex-1">
                    <span className="font-mono text-xs text-muted-foreground mr-1">{asset.assetTag}</span>
                    {asset.name}
                  </Link>
                  {isTech && (
                    <button
                      className="ml-2 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        const ids = (ticket.relatedAssets ?? []).filter((a: { id: string }) => a.id !== asset.id).map((a: { id: string }) => a.id);
                        updateMutation.mutate({ relatedAssets: ids });
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {isTech && (
                <div className="relative pt-1">
                  <Input
                    className="h-7 text-xs"
                    placeholder="Search assets to link..."
                    value={assetSearch}
                    onChange={(e) => setAssetSearch(e.target.value)}
                    onFocus={() => assetResults.length > 0 && setShowAssetResults(true)}
                    onBlur={() => setTimeout(() => setShowAssetResults(false), 150)}
                  />
                  {showAssetResults && assetResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white dark:bg-zinc-900 border rounded-md shadow-md mt-1 max-h-48 overflow-y-auto">
                      {assetResults.map((a) => (
                        <button
                          key={a.id}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex gap-2"
                          onMouseDown={() => {
                            const current = (ticket.relatedAssets ?? []).map((x: { id: string }) => x.id);
                            if (!current.includes(a.id)) {
                              updateMutation.mutate({ relatedAssets: [...current, a.id] });
                            }
                            setAssetSearch('');
                            setShowAssetResults(false);
                          }}
                        >
                          <span className="font-mono text-muted-foreground">{a.assetTag}</span>
                          <span>{a.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
