import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, RotateCcw, Pencil, UserX, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  factory_manager: 'Factory Manager',
  department_head: 'Dept Head',
  team_member: 'Team Member',
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-destructive/10 text-destructive',
  factory_manager: 'bg-primary/10 text-primary',
  department_head: 'bg-warning/10 text-warning',
  team_member: 'bg-muted text-muted-foreground',
};

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  employee_id: string | null;
  designation: string | null;
  is_active: boolean;
  roles: AppRole[];
  departments: { id: string; name: string }[];
}

function useUsers(showInactive: boolean) {
  return useQuery({
    queryKey: ['admin-users', showInactive],
    queryFn: async (): Promise<UserRow[]> => {
      const profilesQ = supabase.from('profiles').select('*');
      if (!showInactive) profilesQ.eq('is_active', true);
      const { data: profiles, error } = await profilesQ.order('full_name');
      if (error) throw error;

      const { data: allRoles } = await supabase.from('user_roles').select('user_id, role');
      const { data: allDepts } = await supabase.from('user_departments').select('user_id, department_id, department:department(id, name)');

      return (profiles || []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        employee_id: p.employee_id,
        designation: p.designation,
        is_active: p.is_active,
        roles: (allRoles || []).filter((r) => r.user_id === p.id).map((r) => r.role),
        departments: (allDepts || [])
          .filter((d) => d.user_id === p.id)
          .map((d: any) => d.department ?? { id: d.department_id, name: 'Unknown' }),
      }));
    },
  });
}

function useDepartments() {
  return useQuery({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('department')
        .select('id, name, code')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });
}

function CreateUserDialog() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'team_member' as AppRole,
    department_ids: [] as string[],
    employee_id: '',
    designation: '',
  });
  const { data: departments } = useDepartments();

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('create_user', {
        body: {
          ...form,
          employee_id: form.employee_id || undefined,
          designation: form.designation || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      return data;
    },
    onSuccess: () => {
      toast({ title: 'User created successfully' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setOpen(false);
      setForm({ full_name: '', email: '', password: '', role: 'team_member', department_ids: [], employee_id: '', designation: '' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error creating user', description: err.message, variant: 'destructive' });
    },
  });

  const toggleDept = (id: string) => {
    setForm((f) => ({
      ...f,
      department_ids: f.department_ids.includes(id) ? f.department_ids.filter((d) => d !== id) : [...f.department_ids, id],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={isMobile ? 'default' : 'sm'} className="gap-1.5">
          <Plus className="h-4 w-4" /> Create User
        </Button>
      </DialogTrigger>
      <DialogContent className={isMobile ? 'h-full max-h-full w-full max-w-full rounded-none' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 overflow-y-auto max-h-[calc(100dvh-8rem)] md:max-h-[70vh]"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Role *</Label>
            <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as AppRole }))}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Departments</Label>
            <div className="max-h-40 overflow-y-auto rounded-md border p-3 space-y-2">
              {departments?.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer min-h-[2.5rem]">
                  <Checkbox checked={form.department_ids.includes(d.id)} onCheckedChange={() => toggleDept(d.id)} />
                  <span>{d.name} ({d.code})</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Input value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} className="h-11" />
            </div>
          </div>
          <Button type="submit" className="w-full h-11" disabled={createMutation.isPending}>
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create User
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserCard({ user, onDeactivate }: { user: UserRow; onDeactivate: (id: string) => void }) {
  return (
    <Card className={!user.is_active ? 'opacity-60' : ''}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-foreground">{user.full_name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          {!user.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
        </div>
        <div className="flex flex-wrap gap-1">
          {user.roles.map((r) => (
            <Badge key={r} className={`text-xs ${ROLE_COLORS[r]}`}>{ROLE_LABELS[r]}</Badge>
          ))}
        </div>
        {user.departments.length > 0 && (
          <p className="text-xs text-muted-foreground">{user.departments.map((d) => d.name).join(', ')}</p>
        )}
        {user.is_active && (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1" disabled>
              <RotateCcw className="h-3 w-3" /> Reset PW
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1" disabled>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1 text-destructive" onClick={() => onDeactivate(user.id)}>
              <UserX className="h-3 w-3" /> Deactivate
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminUsers() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [showInactive, setShowInactive] = useState(false);
  const { data: users, isLoading } = useUsers(showInactive);

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'User deactivated' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-foreground md:text-2xl">User Management</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            Show inactive
          </label>
          <CreateUserDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isMobile ? (
        <div className="space-y-3">
          {users?.map((u) => <UserCard key={u.id} user={u} onDeactivate={(id) => deactivateMutation.mutate(id)} />)}
          {users?.length === 0 && <p className="text-center text-muted-foreground py-8">No users found</p>}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((u) => (
                <TableRow key={u.id} className={!u.is_active ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} className={`text-xs ${ROLE_COLORS[r]}`}>{ROLE_LABELS[r]}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {u.departments.map((d) => d.name).join(', ') || '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? 'default' : 'outline'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {u.is_active && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Reset Password" disabled><RotateCcw className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="Edit" disabled><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" title="Deactivate" className="text-destructive hover:text-destructive" onClick={() => deactivateMutation.mutate(u.id)}>
                          <UserX className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users?.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
