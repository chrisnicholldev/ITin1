import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Shield, Building2, User, Mail, CheckCircle2, ChevronRight, ChevronLeft, Eye, EyeOff, Key, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { completeSetup } from '@/api/setup';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FormState {
  orgName: string;
  adminDisplayName: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
  adminPasswordConfirm: string;
  smtpEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
}

const INITIAL: FormState = {
  orgName: '',
  adminDisplayName: '',
  adminEmail: '',
  adminUsername: '',
  adminPassword: '',
  adminPasswordConfirm: '',
  smtpEnabled: false,
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
};

// ── Step indicator ────────────────────────────────────────────────────────────

const STEPS = ['Welcome', 'Organisation', 'Admin Account', 'Email', 'Backup Key', 'Done'];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
              ${i < current ? 'bg-primary text-primary-foreground' :
                i === current ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' :
                'bg-muted text-muted-foreground'}`}
            >
              {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-xs hidden sm:block ${i === current ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-12 sm:w-16 h-0.5 mb-4 mx-1 transition-colors ${i < current ? 'bg-primary' : 'bg-muted'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Steps ─────────────────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center">
          <Shield className="w-10 h-10 text-primary-foreground" />
        </div>
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Welcome to ITin1</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Let's get your instance set up. This will only take a couple of minutes.
          We'll walk you through the essentials — you can configure everything else from the admin panel later.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-lg mx-auto pt-2">
        {[
          { icon: Building2, title: 'Organisation', desc: 'Name your instance' },
          { icon: User, title: 'Admin account', desc: 'Your login credentials' },
          { icon: Mail, title: 'Email (optional)', desc: 'Enable alert digests' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{title}</span>
            </div>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>
      <Button size="lg" onClick={onNext} className="gap-2">
        Get started <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

function StepOrg({ form, setForm, errors }: { form: FormState; setForm: (f: Partial<FormState>) => void; errors: Partial<Record<keyof FormState, string>> }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Organisation</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This name appears in the sidebar, emails, and the browser tab.
        </p>
      </div>
      <Field label="Organisation name" hint="e.g. Acme IT, Helpdesk, or your company name" error={errors.orgName}>
        <Input
          value={form.orgName}
          onChange={(e) => setForm({ orgName: e.target.value })}
          placeholder="Acme Corp IT"
          autoFocus
        />
      </Field>
    </div>
  );
}

function StepAdmin({ form, setForm, errors }: { form: FormState; setForm: (f: Partial<FormState>) => void; errors: Partial<Record<keyof FormState, string>> }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Admin account</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This will be your super admin login. You can create additional users from the admin panel once you're in.
        </p>
      </div>
      <div className="space-y-4">
        <Field label="Display name" hint="Your full name — shown in the UI" error={errors.adminDisplayName}>
          <Input
            value={form.adminDisplayName}
            onChange={(e) => setForm({ adminDisplayName: e.target.value })}
            placeholder="Jane Smith"
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Username" hint="Used to log in" error={errors.adminUsername}>
            <Input
              value={form.adminUsername}
              onChange={(e) => setForm({ adminUsername: e.target.value.toLowerCase() })}
              placeholder="admin"
            />
          </Field>
          <Field label="Email" error={errors.adminEmail}>
            <Input
              type="email"
              value={form.adminEmail}
              onChange={(e) => setForm({ adminEmail: e.target.value })}
              placeholder="jane@acme.com"
            />
          </Field>
        </div>
        <Field label="Password" hint="Minimum 8 characters" error={errors.adminPassword}>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={form.adminPassword}
              onChange={(e) => setForm({ adminPassword: e.target.value })}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
        <Field label="Confirm password" error={errors.adminPasswordConfirm}>
          <Input
            type="password"
            value={form.adminPasswordConfirm}
            onChange={(e) => setForm({ adminPasswordConfirm: e.target.value })}
            placeholder="••••••••"
          />
        </Field>
      </div>
    </div>
  );
}

function StepSmtp({ form, setForm }: { form: FormState; setForm: (f: Partial<FormState>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Email (optional)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure SMTP to receive renewal alert digests for SSL certificates, licences, and contracts.
          You can skip this and set it up later under <strong>Settings → Integrations</strong>.
        </p>
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.smtpEnabled}
          onChange={(e) => setForm({ smtpEnabled: e.target.checked })}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium">Enable email notifications</span>
      </label>

      {form.smtpEnabled && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label="SMTP host">
                <Input
                  value={form.smtpHost}
                  onChange={(e) => setForm({ smtpHost: e.target.value })}
                  placeholder="smtp.example.com"
                  autoFocus
                />
              </Field>
            </div>
            <Field label="Port">
              <Input
                type="number"
                value={form.smtpPort}
                onChange={(e) => setForm({ smtpPort: e.target.value })}
                placeholder="587"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Username">
              <Input
                value={form.smtpUser}
                onChange={(e) => setForm({ smtpUser: e.target.value })}
                placeholder="alerts@example.com"
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={form.smtpPass}
                onChange={(e) => setForm({ smtpPass: e.target.value })}
                placeholder="••••••••"
              />
            </Field>
          </div>
          <Field label="From address" hint={'e.g. "ITin1 <itdesk@example.com>"'}>
            <Input
              value={form.smtpFrom}
              onChange={(e) => setForm({ smtpFrom: e.target.value })}
              placeholder="ITin1 <itdesk@example.com>"
            />
          </Field>
        </div>
      )}
    </div>
  );
}

function StepBackupKey({ vaultKey, acknowledged, onAcknowledge }: { vaultKey: string | null; acknowledged: boolean; onAcknowledge: (v: boolean) => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (!vaultKey) return;
    navigator.clipboard.writeText(vaultKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Key was supplied via env — operator manages backup themselves, nothing to show
  if (vaultKey === null) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
            <Key className="w-5 h-5 text-green-700 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Encryption key</h2>
            <p className="text-sm text-muted-foreground">Your vault key was provided via environment variable — no action needed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
          <Key className="w-5 h-5 text-amber-700 dark:text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Back up your encryption key</h2>
          <p className="text-sm text-muted-foreground">This key encrypts all secrets stored in the Vault.</p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-1">
        <p className="font-medium">Keep this key safe</p>
        <p>If you ever restore from backup, you'll need this key to decrypt your vault entries. Store it in a password manager or secure note — it won't be shown again after this screen.</p>
      </div>

      {vaultKey ? (
        <div className="space-y-2">
          <Label className="text-xs">Your vault encryption key</Label>
          <div className="flex gap-2">
            <code className="flex-1 block rounded-md border bg-muted px-3 py-2 text-xs font-mono break-all select-all">
              {vaultKey}
            </code>
            <Button variant="outline" size="icon" className="flex-shrink-0 h-auto" onClick={copy}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <div className="h-12 rounded-md bg-muted animate-pulse" />
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
          className="w-4 h-4 mt-0.5 flex-shrink-0"
        />
        <span className="text-sm">I've copied and saved this key somewhere safe</span>
      </label>
    </div>
  );
}

function StepDone({ orgName, onLogin }: { orgName: string; onLogin: () => void }) {
  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">You're all set!</h2>
        <p className="text-muted-foreground">
          <strong>{orgName || 'ITin1'}</strong> is ready. Sign in with the admin account you just created.
        </p>
      </div>
      <div className="text-left border rounded-lg p-4 space-y-2 max-w-sm mx-auto bg-muted/40">
        <p className="text-sm font-medium">What's next</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Sign in and explore the dashboard</li>
          <li>Add your team under <strong>Admin → Users</strong></li>
          <li>Set up AD/LDAP or Intune under <strong>Settings → Integrations</strong></li>
          <li>Import your existing assets and credentials</li>
        </ul>
      </div>
      <Button size="lg" onClick={onLogin} className="gap-2">
        Go to login <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setFormRaw] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [apiError, setApiError] = useState('');
  const [keyAcknowledged, setKeyAcknowledged] = useState(false);
  const [vaultKey, setVaultKey] = useState<string | null>(null);

  function setForm(partial: Partial<FormState>) {
    setFormRaw((prev) => ({ ...prev, ...partial }));
    // Clear errors for updated fields
    const cleared = Object.fromEntries(Object.keys(partial).map((k) => [k, undefined]));
    setErrors((prev) => ({ ...prev, ...cleared }));
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => completeSetup({
      orgName: form.orgName,
      adminDisplayName: form.adminDisplayName,
      adminEmail: form.adminEmail,
      adminUsername: form.adminUsername,
      adminPassword: form.adminPassword,
      smtp: form.smtpEnabled && form.smtpHost ? {
        enabled: true,
        host: form.smtpHost,
        port: parseInt(form.smtpPort, 10) || 587,
        user: form.smtpUser,
        pass: form.smtpPass,
        from: form.smtpFrom,
      } : undefined,
    }),
    onSuccess: (data) => {
      setVaultKey(data.vaultKey ?? null);
      setStep(4);
    },
    onError: (err: any) => {
      if (err?.response?.status === 409) {
        navigate('/login');
        return;
      }
      setApiError(err?.response?.data?.message ?? 'Something went wrong. Please try again.');
    },
  });

  function validateStep(s: number): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};

    if (s === 1) {
      if (!form.orgName.trim()) errs.orgName = 'Organisation name is required';
    }

    if (s === 2) {
      if (!form.adminDisplayName.trim()) errs.adminDisplayName = 'Display name is required';
      if (!form.adminUsername.trim()) errs.adminUsername = 'Username is required';
      if (!form.adminEmail.trim()) errs.adminEmail = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.adminEmail)) errs.adminEmail = 'Enter a valid email';
      if (!form.adminPassword) errs.adminPassword = 'Password is required';
      else if (form.adminPassword.length < 8) errs.adminPassword = 'Minimum 8 characters';
      if (form.adminPassword !== form.adminPasswordConfirm) errs.adminPasswordConfirm = 'Passwords do not match';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    if (step === 3) {
      setApiError('');
      submit(); // on success → step 4 (Backup Key)
    } else {
      setStep((s) => s + 1);
    }
  }

  function back() {
    setStep((s) => s - 1);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <StepIndicator current={step} />

        <div className="bg-card border rounded-xl shadow-sm p-8 min-h-[340px] flex flex-col">
          <div className="flex-1">
            {step === 0 && <StepWelcome onNext={() => setStep(1)} />}
            {step === 1 && <StepOrg form={form} setForm={setForm} errors={errors} />}
            {step === 2 && <StepAdmin form={form} setForm={setForm} errors={errors} />}
            {step === 3 && <StepSmtp form={form} setForm={setForm} />}
            {step === 4 && <StepBackupKey vaultKey={vaultKey} acknowledged={keyAcknowledged} onAcknowledge={setKeyAcknowledged} />}
            {step === 5 && <StepDone orgName={form.orgName} onLogin={() => navigate('/login')} />}
          </div>

          {apiError && (
            <p className="text-sm text-destructive mt-4 text-center">{apiError}</p>
          )}

          {step > 0 && step < 5 && (
            <div className="flex items-center justify-between mt-8 pt-4 border-t">
              <Button variant="ghost" onClick={back} className="gap-1" disabled={isPending || step === 4}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
              <div className="flex items-center gap-3">
                {step === 3 && (
                  <Button variant="ghost" onClick={() => { setApiError(''); submit(); }} disabled={isPending}>
                    Skip
                  </Button>
                )}
                <Button
                  onClick={step === 4 ? () => setStep(5) : next}
                  disabled={isPending || (step === 4 && vaultKey !== null && !keyAcknowledged)}
                  className="gap-1"
                >
                  {isPending ? 'Saving...' : step === 3 ? 'Finish' : 'Continue'}
                  {!isPending && <ChevronRight className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
