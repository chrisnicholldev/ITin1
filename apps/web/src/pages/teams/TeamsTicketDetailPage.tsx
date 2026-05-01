import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTicket } from '@/api/tickets';

const statusVariant: Record<string, string> = {
  open: 'default',
  in_progress: 'default',
  pending: 'secondary',
  resolved: 'secondary',
  closed: 'outline',
};

const priorityColour: Record<string, string> = {
  critical: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-yellow-600',
  low: 'text-muted-foreground',
};

export function TeamsTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => getTicket(id!),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) return null;

  const t = ticket as any;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground" onClick={() => navigate('/teams/tickets')}>
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </Button>

      <div>
        <div className="flex items-start gap-2 flex-wrap">
          <Badge variant={(statusVariant[t.status] ?? 'secondary') as any}>
            {t.status.replace('_', ' ')}
          </Badge>
          <span className={`text-xs font-medium ${priorityColour[t.priority] ?? ''}`}>
            {t.priority} priority
          </span>
        </div>
        <h1 className="text-lg font-semibold mt-2">{t.title}</h1>
        <p className="text-xs text-muted-foreground mt-1">{t.ticketNumber} · {t.category?.name}</p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm font-medium mb-1 text-muted-foreground">Description</p>
        <p className="text-sm whitespace-pre-wrap">{t.description}</p>
      </div>

      {t.comments?.filter((c: any) => !c.isInternal).length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Updates</p>
          {t.comments
            .filter((c: any) => !c.isInternal)
            .map((c: any) => (
              <div key={c.id} className="rounded-lg border bg-card p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {c.author?.displayName ?? 'IT Staff'} · {new Date(c.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm whitespace-pre-wrap">{c.body}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
