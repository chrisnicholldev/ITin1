import { useState } from 'react';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { revealPassword, copyPassword } from '@/api/vault';

export function PasswordCell({ id }: { id: string }) {
  const [visible, setVisible] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReveal() {
    if (visible) { setVisible(false); return; }
    setLoading(true);
    try {
      const res = await revealPassword(id);
      setPassword(res.password);
      setVisible(true);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    setLoading(true);
    try {
      const res = await copyPassword(id);
      await navigator.clipboard.writeText(res.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-sm">
        {visible && password ? password : '••••••••'}
      </span>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleReveal} disabled={loading}>
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy} disabled={loading}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
