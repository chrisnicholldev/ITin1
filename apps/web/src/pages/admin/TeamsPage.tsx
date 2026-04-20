import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Loader2, UserPlus, X, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getTeams, createTeam, updateTeam, deleteTeam, addTeamMember, removeTeamMember, type Team } from '@/api/teams';
import { getUsers } from '@/api/users';

// ── Member avatar ─────────────────────────────────────────────────────────────

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold flex-shrink-0">
      {name?.slice(0, 2).toUpperCase()}
    </div>
  );
}

// ── Team form dialog ──────────────────────────────────────────────────────────

function TeamFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Team | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');

  // Reset fields when dialog opens with new editing value
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName(editing?.name ?? '');
      setDescription(editing?.description ?? '');
    }
    onOpenChange(v);
  };

  const { mutate, isPending, error } = useMutation({
    mutationFn: () =>
      editing
        ? updateTeam(editing.id, { name, description: description || null })
        : createTeam({ name, description: description || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Team' : 'New Team'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Team Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Infrastructure" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this team handles…" />
          </div>
          {error && <p className="text-xs text-destructive">{(error as any)?.response?.data?.error ?? 'Failed to save'}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button disabled={!name.trim() || isPending} onClick={() => mutate()}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Add member dialog ─────────────────────────────────────────────────────────

function AddMemberDialog({
  team,
  open,
  onOpenChange,
}: {
  team: Team;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: usersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => getUsers({ limit: 200 }),
    enabled: open,
  });

  const allUsers: Array<{ id: string; displayName: string; email: string }> =
    usersData?.data ?? usersData ?? [];

  const existingMemberIds = new Set(team.members.map((m) => m.id));
  const filtered = allUsers.filter(
    (u) =>
      !existingMemberIds.has(u.id) &&
      (search === '' ||
        u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())),
  );

  const { mutate, isPending } = useMutation({
    mutationFn: (userId: string) => addTeamMember(team.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      onOpenChange(false);
      setSearch('');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Member to {team.name}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-1">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No users to add</p>
          )}
          {filtered.map((u) => (
            <button
              key={u.id}
              disabled={isPending}
              onClick={() => mutate(u.id)}
              className="flex items-center gap-2 w-full rounded px-2 py-1.5 hover:bg-accent text-left text-sm"
            >
              <Avatar name={u.displayName} />
              <div>
                <p className="font-medium">{u.displayName}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function TeamsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [addMemberFor, setAddMemberFor] = useState<Team | null>(null);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      removeTeamMember(teamId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teams'] }),
  });

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(team: Team) {
    setEditing(team);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" /> Teams
          </h1>
          <p className="text-sm text-muted-foreground">Organise technicians into teams for ticket assignment</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />New Team</Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && teams.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No teams yet. Create one to start assigning tickets by team.
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{team.name}</CardTitle>
                  {team.description && (
                    <CardDescription className="mt-0.5">{team.description}</CardDescription>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(team)}>
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(team.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">
                  {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setAddMemberFor(team)}
                >
                  <UserPlus className="w-3 h-3" /> Add member
                </Button>
              </div>
              {team.members.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No members yet</p>
              ) : (
                <div className="space-y-1">
                  {team.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-muted/50 group">
                      <Avatar name={m.displayName} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMemberMutation.mutate({ teamId: team.id, userId: m.id })}
                        disabled={removeMemberMutation.isPending}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <TeamFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />

      {addMemberFor && (
        <AddMemberDialog
          team={addMemberFor}
          open={!!addMemberFor}
          onOpenChange={(v) => { if (!v) setAddMemberFor(null); }}
        />
      )}
    </div>
  );
}
