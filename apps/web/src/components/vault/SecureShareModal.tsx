import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createSecureShare } from '@/api/secure-share';

interface Props {
  target: { contentType: 'credential'; id: string; title: string } | { contentType: 'note' };
  onClose: () => void;
}

const EXPIRY_OPTIONS = [
  { label: '1 hour',   value: 1 },
  { label: '4 hours',  value: 4 },
  { label: '24 hours', value: 24 },
  { label: '3 days',   value: 72 },
  { label: '7 days',   value: 168 },
];

const VIEW_OPTIONS = [
  { label: 'View once',     value: 1 },
  { label: '3 views',       value: 3 },
  { label: '5 views',       value: 5 },
  { label: 'Unlimited',     value: 999 },
];

export function SecureShareModal({ target, onClose }: Props) {
  const [to, setTo] = useState('');
  const [content, setContent] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [viewLimit, setViewLimit] = useState(1);
  const [result, setResult] = useState<'idle' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => createSecureShare({
      contentType: target.contentType,
      credentialId: target.contentType === 'credential' ? target.id : undefined,
      content: target.contentType === 'note' ? content : undefined,
      recipientEmail: to,
      expiresInHours,
      viewLimit,
    }),
    onSuccess: () => { setResult('ok'); setErrorMsg(''); },
    onError: (err: any) => { setResult('error'); setErrorMsg(err?.response?.data?.error ?? 'Failed to send'); },
  });

  const canSend = !!to && (target.contentType === 'credential' || content.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl w-full max-w-md space-y-5 p-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
            <ShieldCheck className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
          </div>
          <div>
            <p className="font-semibold text-sm">
              {target.contentType === 'credential' ? `Share credential: ${target.title}` : 'Send secure note'}
            </p>
            <p className="text-xs text-muted-foreground">
              Recipient receives a one-time link. Content is encrypted at rest.
            </p>
          </div>
        </div>

        {/* Note content (ad-hoc only) */}
        {target.contentType === 'note' && (
          <div className="space-y-1.5">
            <Label>Secure content</Label>
            <Textarea
              placeholder="Password, API key, or any sensitive text…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="resize-none font-mono text-sm"
            />
          </div>
        )}

        {/* Recipient */}
        <div className="space-y-1.5">
          <Label>Recipient email</Label>
          <Input
            type="email"
            placeholder="user@example.com"
            value={to}
            onChange={(e) => { setTo(e.target.value); setResult('idle'); }}
          />
        </div>

        {/* Expiry + view limit */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Expires after</Label>
            <select
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            >
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>View limit</Label>
            <select
              value={viewLimit}
              onChange={(e) => setViewLimit(Number(e.target.value))}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
            >
              {VIEW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Feedback */}
        {result === 'ok' && (
          <p className="text-sm text-green-700">
            Secure link sent to <strong>{to}</strong>. The link will expire in {EXPIRY_OPTIONS.find(o => o.value === expiresInHours)?.label}.
          </p>
        )}
        {result === 'error' && (
          <p className="text-sm text-destructive">{errorMsg}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>
            {result === 'ok' ? 'Close' : 'Cancel'}
          </Button>
          {result !== 'ok' && (
            <Button size="sm" disabled={isPending || !canSend} onClick={() => mutate()} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {isPending ? 'Sending…' : 'Send secure link'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
