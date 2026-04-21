import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pencil, X, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getMe, updateMe, updateNotificationPreferences } from '@/api/users';

const PREFS = [
  { key: 'onTicketCreated', label: 'Ticket submitted confirmation', desc: 'When you submit a new ticket' },
  { key: 'onTicketAssigned', label: 'Ticket assigned to me', desc: 'When a ticket is assigned to you' },
  { key: 'onStatusChanged', label: 'Status changes', desc: 'When a ticket status changes' },
  { key: 'onCommentAdded', label: 'New comments', desc: 'When a comment is added to a ticket' },
] as const;

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !editing) {
      setDisplayName(profile.displayName ?? '');
      setEmail(profile.email ?? '');
      setPhone(profile.phone ?? '');
    }
  }, [profile, editing]);

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setEditing(false);
      setSaveError(null);
    },
    onError: (err: any) => {
      setSaveError(err?.response?.data?.error ?? err?.message ?? 'Failed to save');
    },
  });

  const prefsMutation = useMutation({
    mutationFn: (prefs: Record<string, boolean>) => updateNotificationPreferences(prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  function startEdit() {
    setDisplayName(profile?.displayName ?? '');
    setEmail(profile?.email ?? '');
    setPhone(profile?.phone ?? '');
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const input: Record<string, string> = { displayName };
    if (profile?.authProvider === 'local') input['email'] = email;
    input['phone'] = phone;
    updateMutation.mutate(input);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const prefs = profile?.notificationPreferences ?? {
    onTicketCreated: true, onTicketAssigned: true, onStatusChanged: true, onCommentAdded: true,
  };

  const isLocal = profile?.authProvider === 'local';

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your account details and preferences</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Account</CardTitle>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={startEdit} className="h-8 gap-1.5">
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {isLocal && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Optional"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={updateMutation.isPending} className="gap-1.5">
                  {updateMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Check className="w-3.5 h-3.5" />}
                  Save
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} className="gap-1.5">
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 text-sm">
              {[
                { label: 'Name', value: profile?.displayName },
                { label: 'Email', value: profile?.email },
                { label: 'Username', value: profile?.username },
                { label: 'Role', value: profile?.role?.replace(/_/g, ' ') },
                { label: 'Department', value: profile?.department },
                { label: 'Phone', value: profile?.phone },
              ].filter((r) => r.value).map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="font-medium capitalize">{row.value}</span>
                </div>
              ))}
              {!isLocal && (
                <p className="text-xs text-muted-foreground pt-1">
                  Email is managed by your identity provider.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {PREFS.map(({ key, label, desc }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4"
                checked={prefs[key] !== false}
                onChange={(e) => prefsMutation.mutate({ [key]: e.target.checked })}
              />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
