import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RefreshCw, Lock, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { getSslCerts, createSslCert, updateSslCert, deleteSslCert, checkSslCert, type SslCert } from '@/api/ssl-certs';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@itdesk/shared';

// ── Status helpers ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  valid:          { label: 'Valid',          variant: 'success' as const, icon: CheckCircle,   colour: 'text-green-600' },
  expiring_soon:  { label: 'Expiring Soon',  variant: 'warning' as const, icon: AlertTriangle,  colour: 'text-amber-600' },
  expired:        { label: 'Expired',        variant: 'destructive' as const, icon: XCircle,    colour: 'text-red-600' },
  error:          { label: 'Error',          variant: 'destructive' as const, icon: XCircle,    colour: 'text-red-600' },
  unknown:        { label: 'Unknown',        variant: 'secondary' as const, icon: Clock,        colour: 'text-muted-foreground' },
};

function daysUntil(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function DaysLabel({ expiresAt, status }: { expiresAt?: string; status: SslCert['status'] }) {
  const days = daysUntil(expiresAt);
  if (days === null) return <span className="text-muted-foreground text-xs">—</span>;
  if (days <= 0)  return <span className="text-xs font-semibold text-red-600">Expired</span>;
  const colour = days <= 7 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-green-600';
  return <span className={`text-xs font-semibold ${colour}`}>{days}d</span>;
}

// ── Cert form modal ───────────────────────────────────────────────────────────

function CertModal({ open, onClose, editing }: { open: boolean; onClose: () => void; editing?: SslCert }) {
  const queryClient = useQueryClient();
  const [domain, setDomain] = useState(editing?.domain ?? '');
  const [port,   setPort]   = useState(String(editing?.port ?? 443));
  const [notes,  setNotes]  = useState(editing?.notes ?? '');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      editing
        ? updateSslCert(editing.id, { domain: domain.trim(), port: Number(port), notes: notes || undefined })
        : createSslCert({ domain: domain.trim(), port: Number(port) || 443, notes: notes || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssl-certs'] });
      onClose();
    },
  });

  function handleClose() {
    setDomain(editing?.domain ?? '');
    setPort(String(editing?.port ?? 443));
    setNotes(editing?.notes ?? '');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Certificate' : 'Add SSL Certificate'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Domain <span className="text-destructive">*</span></Label>
            <Input
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Hostname only — no https:// prefix</p>
          </div>
          <div className="space-y-1.5">
            <Label>Port</Label>
            <Input
              type="number"
              placeholder="443"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-28"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{(error as any)?.response?.data?.error ?? 'An error occurred'}</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button onClick={() => mutate()} disabled={isPending || !domain.trim()}>
            {isPending ? (editing ? 'Saving...' : 'Adding...') : (editing ? 'Save' : 'Add & Check')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function SslCertsPage() {
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role === UserRole.IT_ADMIN || user?.role === UserRole.SUPER_ADMIN;
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<SslCert | undefined>();
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const { data: certs = [], isLoading } = useQuery({
    queryKey: ['ssl-certs'],
    queryFn:  getSslCerts,
  });

  const { mutate: doDelete } = useMutation({
    mutationFn: deleteSslCert,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ssl-certs'] }),
  });

  const { mutate: doCheck } = useMutation({
    mutationFn: (id: string) => {
      setCheckingId(id);
      return checkSslCert(id);
    },
    onSettled: () => {
      setCheckingId(null);
      queryClient.invalidateQueries({ queryKey: ['ssl-certs'] });
    },
  });

  function openAdd() {
    setEditing(undefined);
    setModalOpen(true);
  }

  function openEdit(cert: SslCert) {
    setEditing(cert);
    setModalOpen(true);
  }

  // Summary counts
  const expired       = certs.filter((c) => c.status === 'expired').length;
  const expiringSoon  = certs.filter((c) => c.status === 'expiring_soon').length;
  const valid         = certs.filter((c) => c.status === 'valid').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SSL Certificates</h1>
          <p className="text-sm text-muted-foreground">
            {certs.length} certificate{certs.length !== 1 ? 's' : ''} tracked
            {expired > 0 && <span className="text-red-600 font-medium"> · {expired} expired</span>}
            {expiringSoon > 0 && <span className="text-amber-600 font-medium"> · {expiringSoon} expiring soon</span>}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Certificate
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {certs.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Valid',          count: valid,        colour: 'text-green-600' },
            { label: 'Expiring Soon',  count: expiringSoon, colour: 'text-amber-600' },
            { label: 'Expired',        count: expired,      colour: 'text-red-600'   },
            { label: 'Error / Unknown',count: certs.filter((c) => c.status === 'error' || c.status === 'unknown').length, colour: 'text-muted-foreground' },
          ].map((s) => (
            <Card key={s.label} className="py-3">
              <CardContent className="px-4 py-0">
                <p className={`text-2xl font-bold ${s.colour}`}>{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {/* Column headers */}
          <div className="hidden lg:flex items-center gap-4 px-4 py-2 border-b text-xs text-muted-foreground">
            <span className="w-6 shrink-0"></span>
            <span className="w-48 shrink-0">Domain</span>
            <span className="flex-1">Common Name / Issuer / SANs</span>
            <span className="w-32 text-right shrink-0">Issued → Expires</span>
            <span className="w-16 text-right shrink-0">Days left</span>
            <span className="w-28 text-right shrink-0">Status</span>
            {isAdmin && <span className="w-20 shrink-0"></span>}
          </div>

          {isLoading && <div className="p-8 text-center text-muted-foreground text-sm">Loading...</div>}
          {!isLoading && certs.length === 0 && (
            <div className="p-12 text-center">
              <Lock className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No certificates tracked yet.</p>
              {isAdmin && (
                <Button variant="outline" className="mt-3" onClick={openAdd}>
                  <Plus className="w-4 h-4" /> Add your first certificate
                </Button>
              )}
            </div>
          )}

          <div className="divide-y">
            {certs.map((cert) => {
              const cfg = STATUS_CONFIG[cert.status];
              const StatusIcon = cfg.icon;
              const days = daysUntil(cert.expiresAt);
              const isChecking = checkingId === cert.id;

              return (
                <div key={cert.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors">
                  <StatusIcon className={`w-4 h-4 shrink-0 ${cfg.colour}`} />

                  <div className="w-48 shrink-0 min-w-0">
                    <p className="text-sm font-medium truncate">{cert.domain}{cert.port !== 443 ? `:${cert.port}` : ''}</p>
                    {cert.lastCheckedAt && (
                      <p className="text-xs text-muted-foreground">
                        Checked {new Date(cert.lastCheckedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{cert.commonName ?? <span className="text-muted-foreground italic">Not yet checked</span>}</p>
                    <p className="text-xs text-muted-foreground truncate">{cert.issuer ?? ''}</p>
                    {cert.sans.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate">
                        {cert.sans.slice(0, 4).join(', ')}{cert.sans.length > 4 ? ` +${cert.sans.length - 4} more` : ''}
                      </p>
                    )}
                    {cert.checkError && (
                      <p className="text-xs text-destructive truncate">{cert.checkError}</p>
                    )}
                  </div>

                  <div className="w-32 text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cert.expiresAt ? new Date(cert.expiresAt).toLocaleDateString() : '—'}
                    </p>
                  </div>

                  <div className="w-16 text-right shrink-0">
                    <DaysLabel expiresAt={cert.expiresAt} status={cert.status} />
                  </div>

                  <div className="w-28 text-right shrink-0">
                    <Badge variant={(cfg.variant as any) ?? 'secondary'}>{cfg.label}</Badge>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 w-20 justify-end shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Refresh certificate info"
                        disabled={isChecking}
                        onClick={() => doCheck(cert.id)}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        title="Edit"
                        onClick={() => openEdit(cert)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Delete"
                        onClick={() => {
                          if (confirm(`Remove ${cert.domain} from tracking?`)) doDelete(cert.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <CertModal open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />
    </div>
  );
}
