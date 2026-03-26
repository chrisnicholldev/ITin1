import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, ShieldOff, Copy, Check, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { twoFactorSetup, twoFactorConfirm, twoFactorDisable, getMe } from '@/api/auth';
import { getOrgSettings, updateOrgSettings } from '@/api/settings';

type SetupStage = 'idle' | 'qr' | 'confirm' | 'recovery';

export function SettingsPage() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();

  // ── Org settings ────────────────────────────────────────────────────────────
  const { data: orgSettings } = useQuery({ queryKey: ['org-settings'], queryFn: getOrgSettings });
  const [orgName, setOrgName] = useState('');
  const [orgSaveError, setOrgSaveError] = useState<string | null>(null);
  const [orgSaved, setOrgSaved] = useState(false);

  useEffect(() => {
    if (orgSettings?.orgName) setOrgName(orgSettings.orgName);
  }, [orgSettings?.orgName]);

  const saveOrg = useMutation({
    mutationFn: () => updateOrgSettings({ orgName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
      setOrgSaved(true);
      setOrgSaveError(null);
      setTimeout(() => setOrgSaved(false), 2000);
    },
    onError: (e: any) => setOrgSaveError(e?.response?.data?.error ?? e?.message),
  });

  const [setupStage, setSetupStage] = useState<SetupStage>('idle');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const twoFactorEnabled = (user as any)?.twoFactorEnabled ?? false;

  const startSetup = useMutation({
    mutationFn: () => twoFactorSetup(),
    onSuccess: (data) => {
      setQrDataUrl(data.qrCodeDataUrl);
      setSecret(data.secret);
      setSetupStage('qr');
      setError(null);
    },
    onError: (e: any) => setError(e?.response?.data?.error ?? e?.message),
  });

  const confirmSetup = useMutation({
    mutationFn: () => twoFactorConfirm(setupCode),
    onSuccess: async (data) => {
      setRecoveryCodes(data.recoveryCodes);
      setSetupStage('recovery');
      setSetupCode('');
      setError(null);
      const fresh = await getMe();
      setUser(fresh);
    },
    onError: (e: any) => { setError(e?.response?.data?.error ?? e?.message); setSetupCode(''); },
  });

  const disable = useMutation({
    mutationFn: () => twoFactorDisable(disableCode),
    onSuccess: async () => {
      setDisableCode('');
      setError(null);
      const fresh = await getMe();
      setUser(fresh);
    },
    onError: (e: any) => { setError(e?.response?.data?.error ?? e?.message); setDisableCode(''); },
  });

  function copyRecoveryCodes() {
    const text = recoveryCodes.join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account security</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organisation
          </CardTitle>
          <CardDescription>Customise how your organisation appears in the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organisation name</Label>
            <div className="flex gap-2">
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="IT Helpdesk"
                className="max-w-xs"
              />
              <Button
                disabled={!orgName.trim() || saveOrg.isPending || orgName === orgSettings?.orgName}
                onClick={() => saveOrg.mutate()}
              >
                {orgSaved ? <><Check className="w-4 h-4 mr-2" />Saved</> : 'Save'}
              </Button>
            </div>
            {orgSaveError && <p className="text-xs text-destructive">{orgSaveError}</p>}
            <p className="text-xs text-muted-foreground">Shown in the sidebar, login page, and browser tab.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            {twoFactorEnabled
              ? 'Your account is protected with two-factor authentication.'
              : 'Add an extra layer of security to your account.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── 2FA enabled: show disable option ── */}
          {twoFactorEnabled && setupStage === 'idle' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                2FA is active on your account
              </div>
              <div className="space-y-2">
                <Label htmlFor="disable-code">Enter your current authenticator code to disable 2FA</Label>
                <div className="flex gap-2">
                  <Input
                    id="disable-code"
                    placeholder="000000"
                    inputMode="numeric"
                    maxLength={6}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    className="max-w-[140px]"
                  />
                  <Button
                    variant="destructive"
                    disabled={disableCode.length < 6 || disable.isPending}
                    onClick={() => disable.mutate()}
                  >
                    <ShieldOff className="w-4 h-4 mr-2" />
                    Disable 2FA
                  </Button>
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            </div>
          )}

          {/* ── 2FA not enabled: start setup ── */}
          {!twoFactorEnabled && setupStage === 'idle' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded px-3 py-2">
                <ShieldOff className="w-4 h-4 flex-shrink-0" />
                2FA is not enabled
              </div>
              <Button onClick={() => startSetup.mutate()} disabled={startSetup.isPending}>
                <ShieldCheck className="w-4 h-4 mr-2" />
                Enable 2FA
              </Button>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}

          {/* ── Setup: show QR ── */}
          {setupStage === 'qr' && (
            <div className="space-y-4">
              <p className="text-sm">Scan this QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.).</p>
              {qrDataUrl && (
                <div className="flex justify-center">
                  <img src={qrDataUrl} alt="2FA QR Code" className="w-44 h-44 rounded border" />
                </div>
              )}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Can't scan? Enter code manually</summary>
                <code className="block mt-1 break-all bg-muted p-2 rounded">{secret}</code>
              </details>
              <div className="space-y-2">
                <Label htmlFor="setup-code">Enter the 6-digit code to confirm setup</Label>
                <Input
                  id="setup-code"
                  placeholder="000000"
                  inputMode="numeric"
                  maxLength={6}
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value)}
                  className="max-w-[140px]"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button
                  disabled={setupCode.length < 6 || confirmSetup.isPending}
                  onClick={() => confirmSetup.mutate()}
                >
                  Confirm & Enable
                </Button>
                <Button variant="outline" onClick={() => { setSetupStage('idle'); setError(null); setSetupCode(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* ── Setup: show recovery codes ── */}
          {setupStage === 'recovery' && (
            <div className="space-y-4">
              <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                <strong>Save these recovery codes now.</strong> Each can be used once if you lose your authenticator app. They will not be shown again.
              </div>
              <div className="grid grid-cols-2 gap-1 bg-muted rounded p-3">
                {recoveryCodes.map((c) => (
                  <code key={c} className="text-xs font-mono">{c}</code>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyRecoveryCodes}>
                  {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? 'Copied!' : 'Copy codes'}
                </Button>
                <Button onClick={() => setSetupStage('idle')}>Done</Button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
