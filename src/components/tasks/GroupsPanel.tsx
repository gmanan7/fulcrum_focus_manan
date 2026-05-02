import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Loader2, Trash2, Pencil, ArrowLeft, Check, LogOut, X,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  GROUP_COLOR_PRESETS,
  canManageGroupMembers,
  canDeleteGroup,
  canCreateGroup,
} from '@/lib/taskGroups';

type Mode = 'list' | 'create' | { kind: 'detail'; groupId: string };

interface GroupsPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function GroupsPanel({ open, onOpenChange }: GroupsPanelProps) {
  const { user, hasAnyRole, roles } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('list');
  const isAdmin = hasAnyRole('super_admin', 'factory_manager');

  const { data: groups, isLoading } = useQuery({
    queryKey: ['task-groups', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_groups' as any)
        .select('id, name, color, created_by, factory_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: open && !!user,
  });

  const { data: memberRows } = useQuery({
    queryKey: ['task-group-members-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_group_members' as any)
        .select('group_id, user_id');
      if (error) throw error;
      return ((data as unknown) || []) as Array<{ group_id: string; user_id: string }>;
    },
    enabled: open && !!user,
  });

  const memberCountByGroup = useMemo(() => {
    const m = new Map<string, number>();
    (memberRows || []).forEach((r) => m.set(r.group_id, (m.get(r.group_id) ?? 0) + 1));
    return m;
  }, [memberRows]);

  const myGroupIds = useMemo(() => {
    return new Set((memberRows || []).filter((r) => r.user_id === user?.id).map((r) => r.group_id));
  }, [memberRows, user?.id]);

  const visibleGroups = (groups || []).filter((g) => {
    if (isAdmin) return true;
    return g.created_by === user?.id || myGroupIds.has(g.id);
  });

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setMode('list'); }}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {mode !== 'list' && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMode('list')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            {mode === 'list' && (isAdmin ? 'All Groups' : 'My Groups')}
            {mode === 'create' && 'Create Group'}
            {typeof mode === 'object' && mode.kind === 'detail' && 'Group Members'}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          {mode === 'list' && (
            <div className="space-y-3">
              <Button size="sm" className="w-full gap-1" onClick={() => setMode('create')}>
                <Plus className="h-4 w-4" /> Create Group
              </Button>
              {isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
              ) : visibleGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No groups yet.</p>
              ) : (
                <div className="space-y-2">
                  {visibleGroups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setMode({ kind: 'detail', groupId: g.id })}
                      className="w-full text-left rounded-lg border p-3 hover:bg-muted/30 transition-colors flex items-center gap-2"
                    >
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: g.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{g.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {memberCountByGroup.get(g.id) ?? 0} member(s)
                          {g.created_by === user?.id && ' · created by you'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'create' && (
            <CreateGroupForm
              onCreated={() => {
                queryClient.invalidateQueries({ queryKey: ['task-groups'] });
                queryClient.invalidateQueries({ queryKey: ['task-group-members-all'] });
                setMode('list');
              }}
              onCancel={() => setMode('list')}
            />
          )}

          {typeof mode === 'object' && mode.kind === 'detail' && (
            <GroupDetail
              groupId={mode.groupId}
              group={(groups || []).find((g) => g.id === mode.groupId)}
              userId={user?.id ?? null}
              roles={roles as string[]}
              onClose={() => setMode('list')}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Create form
// ---------------------------------------------------------------------------

function CreateGroupForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [color, setColor] = useState(GROUP_COLOR_PRESETS[0].value);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: factory } = useQuery({
    queryKey: ['default-factory'],
    queryFn: async () => {
      const { data } = await supabase.from('factory').select('id').eq('is_active', true).limit(1).single();
      return data;
    },
  });

  const { data: users } = useQuery({
    queryKey: ['all-active-users'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');
      return data || [];
    },
  });

  const { data: userDepts } = useQuery({
    queryKey: ['user-departments-all'],
    queryFn: async () => {
      const { data: uds } = await supabase.from('user_departments').select('user_id, department_id, is_primary');
      const { data: depts } = await supabase.from('department').select('id, name');
      const deptMap = new Map((depts || []).map((d) => [d.id, d.name]));
      const m = new Map<string, string>();
      (uds || []).forEach((r) => {
        if (r.is_primary && deptMap.has(r.department_id)) m.set(r.user_id, deptMap.get(r.department_id) as string);
        else if (!m.has(r.user_id) && deptMap.has(r.department_id)) m.set(r.user_id, deptMap.get(r.department_id) as string);
      });
      return m;
    },
  });

  const filtered = (users || []).filter((u) => u.id !== user?.id && (
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase())
  ));

  const create = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Group name required');
      if (!factory?.id) throw new Error('No active factory found');
      const { data: g, error: e1 } = await supabase
        .from('task_groups' as any)
        .insert({ name: name.trim(), color, created_by: user!.id, factory_id: factory.id } as any)
        .select('id')
        .single();
      if (e1) throw e1;
      const groupId = (g as any).id as string;
      const memberIds = Array.from(new Set([user!.id, ...Array.from(selected)]));
      const rows = memberIds.map((uid) => ({ group_id: groupId, user_id: uid, added_by: user!.id }));
      const { error: e2 } = await supabase.from('task_group_members' as any).insert(rows as any);
      if (e2) throw e2;
    },
    onSuccess: () => { toast({ title: 'Group created' }); onCreated(); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Group name *</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 mt-1" placeholder="e.g. Alpha Team" />
      </div>
      <div>
        <Label className="text-xs">Colour</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {GROUP_COLOR_PRESETS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={cn('h-7 w-7 rounded-full border-2 transition-transform',
                color === c.value ? 'border-foreground scale-110' : 'border-transparent')}
              style={{ backgroundColor: c.value }}
              aria-label={c.name}
              title={c.name}
            />
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs">Members</Label>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users…" className="h-9 mt-1" />
        <p className="text-[10px] text-muted-foreground mt-1">You'll be added automatically as creator.</p>
        <ScrollArea className="h-56 mt-2 rounded border">
          <div className="p-2 space-y-1">
            {filtered.map((u) => {
              const checked = selected.has(u.id);
              return (
                <label key={u.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/40 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(u.id); else next.delete(u.id);
                      setSelected(next);
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{u.full_name}</span>
                  {userDepts?.get(u.id) && (
                    <Badge variant="secondary" className="text-[10px]">{userDepts.get(u.id)}</Badge>
                  )}
                </label>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No users match.</p>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending} className="flex-1 h-10">
          {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Group
        </Button>
        <Button variant="outline" onClick={onCancel} className="h-10">Cancel</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group detail / member management
// ---------------------------------------------------------------------------

function GroupDetail({
  groupId,
  group,
  userId,
  roles,
  onClose,
}: {
  groupId: string;
  group: any;
  userId: string | null;
  roles: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [renameMode, setRenameMode] = useState(false);
  const [newName, setNewName] = useState(group?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const canManage = group ? canManageGroup(group, userId, roles) : false;
  const isMember = !!userId; // membership lookup happens via RLS on member rows

  const { data: members, refetch } = useQuery({
    queryKey: ['task-group-members', groupId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('task_group_members' as any)
        .select('id, user_id, added_by, created_at')
        .eq('group_id', groupId);
      const ids = (rows || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', ids);
      const profMap = new Map((profs || []).map((p) => [p.id, p]));
      return (rows || []).map((r: any) => ({ ...r, profile: profMap.get(r.user_id) }));
    },
  });

  const memberUserIds = new Set((members || []).map((m: any) => m.user_id));
  const meIsMember = userId ? memberUserIds.has(userId) : false;

  const removeMember = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from('task_group_members' as any).delete().eq('id', rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Member removed' });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['task-group-members-all'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const leave = useMutation({
    mutationFn: async () => {
      const myRow = (members || []).find((m: any) => m.user_id === userId);
      if (!myRow) throw new Error('You are not a member');
      const { error } = await supabase.from('task_group_members' as any).delete().eq('id', (myRow as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Left group' });
      queryClient.invalidateQueries({ queryKey: ['task-groups'] });
      queryClient.invalidateQueries({ queryKey: ['task-group-members-all'] });
      onClose();
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const rename = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) throw new Error('Name required');
      const { error } = await supabase
        .from('task_groups' as any)
        .update({ name: newName.trim() } as any)
        .eq('id', groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Group renamed' });
      setRenameMode(false);
      queryClient.invalidateQueries({ queryKey: ['task-groups'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('task_groups' as any).delete().eq('id', groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Group deleted' });
      queryClient.invalidateQueries({ queryKey: ['task-groups'] });
      queryClient.invalidateQueries({ queryKey: ['task-group-members-all'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!group) {
    return <p className="text-sm text-muted-foreground">Group not found.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: group.color }} />
        {renameMode ? (
          <div className="flex-1 flex gap-1">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8" />
            <Button size="icon" className="h-8 w-8" onClick={() => rename.mutate()} disabled={rename.isPending}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setRenameMode(false); setNewName(group.name); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold flex-1">{group.name}</p>
            {canManage && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRenameMode(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs">Members ({members?.length ?? 0})</Label>
          {canManage && (
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          )}
        </div>
        <div className="space-y-1">
          {(members || []).map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-2 rounded border text-sm">
              <span className="truncate">{m.profile?.full_name ?? m.user_id}</span>
              {canManage && m.user_id !== group.created_by && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeMember.mutate(m.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
              {m.user_id === group.created_by && (
                <Badge variant="secondary" className="text-[10px]">creator</Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      {addOpen && (
        <AddMembersInline
          groupId={groupId}
          existingUserIds={memberUserIds}
          onDone={() => { setAddOpen(false); refetch(); queryClient.invalidateQueries({ queryKey: ['task-group-members-all'] }); }}
          onCancel={() => setAddOpen(false)}
        />
      )}

      <div className="flex gap-2 pt-2 border-t">
        {canManage && (
          <Button variant="destructive" size="sm" className="flex-1 gap-1" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete Group
          </Button>
        )}
        {!canManage && meIsMember && (
          <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => leave.mutate()} disabled={leave.isPending}>
            <LogOut className="h-3.5 w-3.5" /> Leave Group
          </Button>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete group "{group.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Tasks in this group will lose their group association but will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddMembersInline({
  groupId,
  existingUserIds,
  onDone,
  onCancel,
}: {
  groupId: string;
  existingUserIds: Set<string>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: users } = useQuery({
    queryKey: ['all-active-users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name');
      return data || [];
    },
  });

  const filtered = (users || []).filter((u) => !existingUserIds.has(u.id) && (
    !search || u.full_name?.toLowerCase().includes(search.toLowerCase())
  ));

  const add = useMutation({
    mutationFn: async () => {
      if (selected.size === 0) return;
      const rows = Array.from(selected).map((uid) => ({ group_id: groupId, user_id: uid, added_by: user!.id }));
      const { error } = await supabase.from('task_group_members' as any).insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Members added' }); onDone(); },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-9" />
      <ScrollArea className="h-40 rounded border bg-background">
        <div className="p-1.5 space-y-1">
          {filtered.map((u) => {
            const checked = selected.has(u.id);
            return (
              <label key={u.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted/40 cursor-pointer text-sm">
                <input type="checkbox" checked={checked} onChange={(e) => {
                  const next = new Set(selected);
                  if (e.target.checked) next.add(u.id); else next.delete(u.id);
                  setSelected(next);
                }} />
                <span className="truncate">{u.full_name}</span>
              </label>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">No users to add.</p>
          )}
        </div>
      </ScrollArea>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => add.mutate()} disabled={selected.size === 0 || add.isPending} className="flex-1">
          {add.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}Add ({selected.size})
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
