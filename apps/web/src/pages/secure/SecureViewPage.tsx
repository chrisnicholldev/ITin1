import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ShieldCheck, ShieldOff, Copy, Check, Clock, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { viewSecureShare } from '@/api/secure-share';

export function SecureViewPage() {
  const { token } = useParams<{ token: string }>();
  const [copied, setCopied] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['secure-share', token],
    queryFn: () => viewSecureShare(token!),
    enabled: !!token,
    retry: false,
  });

  function copy() {
    if (!data) return;
    navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Error / unavailable states ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (isError) {
    const err = (error as any)?.response?.data;
    const messages: Record<string, { heading: string; body: string }> = {
      destroyed:    { heading: 'Link destroyed',   body: 'This content has already been viewed and the link has been permanently destroyed.' },
      expired:      { heading: 'Link expired',      body: 'This secure link has expired and is no longer accessible.' },
      limit_reached: { heading: 'Limit reached',   body: 'This link has reached its maximum number of views.' },
      not_found:    { heading: 'Link not found',    body: 'This secure link does not exist or has already been removed.' },
    };
    const info = messages[err?.error] ?? { heading: 'Unavailable', body: err?.message ?? 'This link is not available.' };

    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-xl shadow-sm border p-8 text-center space-y-4">
          <ShieldOff className="h-10 w-10 text-zinc-400 mx-auto" />
          <h1 className="text-lg font-semibold">{info.heading}</h1>
          <p className="text-sm text-zinc-500">{info.body}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const expiresAt = new Date(data.expiresAt);
  const isCredential = data.contentType === 'credential';

  // ── Content view ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-4">

        {/* Header card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {isCredential ? `Credential: ${data.credentialTitle}` : 'Secure Note'}
              </p>
              <p className="text-xs text-zinc-500">Shared securely via IT Helpdesk</p>
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Expires {expiresAt.toLocaleString()}
            </span>
            {data.viewsRemaining > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {data.viewsRemaining} view{data.viewsRemaining !== 1 ? 's' : ''} remaining
              </span>
            )}
            {data.viewsRemaining === 0 && (
              <span className="flex items-center gap-1 text-amber-600">
                <Eye className="h-3.5 w-3.5" />
                No views remaining — this link is now destroyed
              </span>
            )}
          </div>
        </div>

        {/* Content card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border p-6 space-y-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            {isCredential ? 'Password' : 'Note'}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-md px-3 py-2 text-sm font-mono break-all select-all">
              {data.content}
            </code>
            <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Warning */}
        <p className="text-xs text-center text-zinc-400">
          Do not share this page or store this content insecurely.
          {data.viewsRemaining === 0 && ' This link is now permanently destroyed.'}
        </p>

      </div>
    </div>
  );
}
