import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe, updateNotificationPreferences } from '@/api/users';

const PREFS = [
  { key: 'onTicketCreated', label: 'Ticket submitted confirmation', desc: 'When you submit a new ticket' },
  { key: 'onTicketAssigned', label: 'Ticket assigned to me', desc: 'When a ticket is assigned to you' },
  { key: 'onStatusChanged', label: 'Status changes', desc: 'When a ticket status changes' },
  { key: 'onCommentAdded', label: 'New comments', desc: 'When a comment is added to a ticket' },
] as const;

export function ProfilePage() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery({ queryKey: ['me'], queryFn: getMe });

  const prefsMutation = useMutation({
    mutationFn: (prefs: Record<string, boolean>) => updateNotificationPreferences(prefs),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

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

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">Your account details and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            { label: 'Name', value: profile?.displayName },
            { label: 'Email', value: profile?.email },
            { label: 'Username', value: profile?.username },
            { label: 'Role', value: profile?.role?.replace('_', ' ') },
            { label: 'Department', value: profile?.department },
          ].filter((r) => r.value).map((row) => (
            <div key={row.label} className="flex justify-between">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium capitalize">{row.value}</span>
            </div>
          ))}
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
