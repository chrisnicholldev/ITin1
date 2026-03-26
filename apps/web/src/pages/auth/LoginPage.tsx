import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Loader2, ShieldCheck, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { login, getMe, twoFactorVerify, twoFactorSetup, twoFactorConfirm } from '@/api/auth';

type Stage = 'credentials' | 'verify' | 'setup' | 'recovery';

export function LoginPage() {
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();

  const [stage, setStage] = useState<Stage>('credentials');
  const [tempToken, setTempToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // credentials stage
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // verify/setup stage
  const [code, setCode] = useState('');

  // setup stage
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  async function completeLogin(accessToken: string) {
    setTokens(accessToken);
    const user = await getMe();
    setUser(user);
    navigate('/dashboard');
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setError(null);
    setLoading(true);
    try {
      const result = await login(username, password);

      if ('accessToken' in result) {
        await completeLogin(result.accessToken);
        return;
      }

      setTempToken(result.tempToken);

      if ('twoFactorRequired' in result) {
        setStage('verify');
      } else {
        // setupRequired — fetch QR code immediately
        const setup = await twoFactorSetup(result.tempToken);
        setQrDataUrl(setup.qrCodeDataUrl);
        setSecret(setup.secret);
        setStage('setup');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setError(null);
    setLoading(true);
    try {
      const result = await twoFactorVerify(tempToken, code);
      await completeLogin(result.accessToken);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Invalid code');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetupConfirm(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setError(null);
    setLoading(true);
    try {
      const result = await twoFactorConfirm(code, tempToken);
      setRecoveryCodes(result.recoveryCodes);
      setStage('recovery');
      // Tokens are returned from confirm — store them now so the next navigation works
      if (result.accessToken) {
        await completeLogin(result.accessToken);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? err?.message ?? 'Invalid code');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  function copyRecoveryCodes() {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
            <Ticket className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">IT Helpdesk</h1>
          {stage === 'credentials' && (
            <p className="text-sm text-muted-foreground">Sign in with your network credentials</p>
          )}
          {stage === 'verify' && (
            <p className="text-sm text-muted-foreground">Enter your authenticator code</p>
          )}
          {stage === 'setup' && (
            <p className="text-sm text-muted-foreground">Set up two-factor authentication</p>
          )}
          {stage === 'recovery' && (
            <p className="text-sm text-muted-foreground">Save your recovery codes</p>
          )}
        </div>

        <Card>
          <CardContent className="pt-6">

            {/* ── Stage 1: credentials ── */}
            {stage === 'credentials' && (
              <form onSubmit={handleCredentials} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="jsmith"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                {error && <ErrorBox message={error} />}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            )}

            {/* ── Stage 2: verify TOTP ── */}
            {stage === 'verify' && (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="flex justify-center mb-2">
                  <ShieldCheck className="w-10 h-10 text-primary" />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Open your authenticator app and enter the 6-digit code for <strong>ITDesk</strong>.
                  You can also enter a recovery code.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="code">Authentication code</Label>
                  <Input
                    id="code"
                    placeholder="000000"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={10}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus
                  />
                </div>
                {error && <ErrorBox message={error} />}
                <Button type="submit" className="w-full" disabled={loading || !code}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-xs"
                  onClick={() => { setStage('credentials'); setError(null); setCode(''); }}
                >
                  Back to login
                </Button>
              </form>
            )}

            {/* ── Stage 3: setup TOTP ── */}
            {stage === 'setup' && (
              <form onSubmit={handleSetupConfirm} className="space-y-4">
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <strong>Admin accounts require 2FA.</strong> Scan the QR code below with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.).
                </div>

                {qrDataUrl && (
                  <div className="flex justify-center">
                    <img src={qrDataUrl} alt="2FA QR Code" className="w-44 h-44 rounded border" />
                  </div>
                )}

                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Can't scan? Enter code manually</summary>
                  <code className="block mt-1 break-all bg-muted p-2 rounded text-xs">{secret}</code>
                </details>

                <div className="space-y-2">
                  <Label htmlFor="setup-code">Enter the 6-digit code to confirm</Label>
                  <Input
                    id="setup-code"
                    placeholder="000000"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoFocus
                  />
                </div>

                {error && <ErrorBox message={error} />}
                <Button type="submit" className="w-full" disabled={loading || code.length < 6}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enable 2FA & Sign in
                </Button>
              </form>
            )}

            {/* ── Stage 4: recovery codes ── */}
            {stage === 'recovery' && (
              <div className="space-y-4">
                <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                  <strong>Save these recovery codes now.</strong> Each can be used once if you lose access to your authenticator app. They will not be shown again.
                </div>

                <div className="grid grid-cols-2 gap-1 bg-muted rounded p-3">
                  {recoveryCodes.map((c) => (
                    <code key={c} className="text-xs font-mono">{c}</code>
                  ))}
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={copyRecoveryCodes}>
                  {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy codes'}
                </Button>

                <Button type="button" className="w-full" onClick={() => navigate('/dashboard')}>
                  I've saved my codes — continue
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}
