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
import { Plus, RotateCcw, Pencil, UserX, UserCheck, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import { logAudit } from '@/lib/auditLog';
import { validateResetPassword } from '@/lib/utils';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  factory_manager: 'Factory Manager',
  department_head: 'Dept Head',
  team_member: 'Team Member',
  shop_floor: 'Shop Floor',
  task_only: 'Task Only',
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: 'bg-destructive/10 text-destructive',
  factory_manager: 'bg-primary/10 text-primary',
  department_head: 'bg-warning/10 text-warning',
  team_member: 'bg-muted text-muted-foreground',
  shop_floor: 'bg-teal-100 text-teal-700',
  task_only: 'bg-violet-100 text-violet-700',
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

/* ─── Create User Dialog ─── */
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
    onSuccess: (data) => {
      toast({ title: 'User created successfully' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setOpen(false);
      setForm({ full_name: '', email: '', password: '', role: 'team_member', department_ids: [], employee_id: '', designation: '' });
      if (data?.user_id) logAudit('profiles', data.user_id, 'INSERT', null, { full_name: form.full_name, email: form.email, role: form.role });
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

/* ─── Edit User Dialog ─── */
function EditUserDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: departments } = useDepartments();
  const [form, setForm] = useState({
    full_name: user.full_name,
    designation: user.designation || '',
    employee_id: user.employee_id || '',
    role: user.roles[0] || ('team_member' as AppRole),
    department_ids: user.departments.map((d) => d.id),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      // 1. Update profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          designation: form.designation || null,
          employee_id: form.employee_id || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
      if (profileErr) throw profileErr;

      // 2. Update role: delete existing, insert new
      await supabase.from('user_roles').delete().eq('user_id', user.id);
      const { error: roleErr } = await supabase.from('user_roles').insert({ user_id: user.id, role: form.role });
      if (roleErr) throw roleErr;

      // 3. Update departments: delete existing, insert new
      await supabase.from('user_departments').delete().eq('user_id', user.id);
      if (form.department_ids.length > 0) {
        const { error: deptErr } = await supabase
          .from('user_departments')
          .insert(form.department_ids.map((did) => ({ user_id: user.id, department_id: did })));
        if (deptErr) throw deptErr;
      }
    },
    onSuccess: () => {
      toast({ title: 'User updated' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: 'Error updating user', description: err.message, variant: 'destructive' });
    },
  });

  const toggleDept = (id: string) => {
    setForm((f) => ({
      ...f,
      department_ids: f.department_ids.includes(id) ? f.department_ids.filter((d) => d !== id) : [...f.department_ids, id],
    }));
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={isMobile ? 'h-full max-h-full w-full max-w-full rounded-none' : 'max-w-lg'}>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4 overflow-y-auto max-h-[calc(100dvh-8rem)] md:max-h-[70vh]"
          onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(); }}
        >
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Employee ID</Label>
            <Input value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} className="h-11" />
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
          <Button type="submit" className="w-full h-11" disabled={updateMutation.isPending}>
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reset Password Dialog ─── */
function ResetPasswordDialog({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const isMobile = useIsMobile();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const err = validateResetPassword(password, confirmPassword);
      if (err) { setValidationError(err); throw new Error(err); }
      setValidationError(null);
      const { data, error } = await supabase.functions.invoke('reset_password', {
        body: { user_id: user.id, new_password: password },
      });
      if (error) throw error;
      if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Password reset successfully' });
      onClose();
    },
    onError: (err: Error) => {
      if (!validationError) {
        toast({ title: 'Error resetting password', description: err.message, variant: 'destructive' });
      }
    },
  });

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={isMobile ? 'h-full max-h-full w-full max-w-full rounded-none' : 'max-w-sm'}>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
        </DialogHeader>
        <p className="text-sm font-medium text-foreground">{user.full_name}</p>
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); resetMutation.mutate(); }}
        >
          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setValidationError(null); }}
                required
                minLength={8}
                className="h-11 pr-10"
              />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-10" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setValidationError(null); }}
                required
                minLength={8}
                className="h-11 pr-10"
              />
              <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-10" onClick={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {validationError && <p className="text-sm text-destructive">{validationError}</p>}
          <Button type="submit" className="w-full h-11" disabled={resetMutation.isPending}>
            {resetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ─── User Card (mobile) ─── */
function UserCard({ user, currentUserId, onDeactivate, onReactivate, onEdit, onResetPassword }: {
  user: UserRow;
  currentUserId: string;
  onDeactivate: (id: string) => void;
  onReactivate: (id: string) => void;
  onEdit: (u: UserRow) => void;
  onResetPassword: (u: UserRow) => void;
}) {
  const isSelf = user.id === currentUserId;
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
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => onResetPassword(user)}>
            <KeyRound className="h-3 w-3" /> Reset PW
          </Button>
          {user.is_active && (
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => onEdit(user)}>
              <Pencil className="h-3 w-3" /> Edit
            </Button>
          )}
          {user.is_active ? (
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1 text-destructive" onClick={() => onDeactivate(user.id)} disabled={isSelf}>
              <UserX className="h-3 w-3" /> Deactivate
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="h-9 text-xs gap-1" onClick={() => onReactivate(user.id)}>
              <UserCheck className="h-3 w-3" /> Reactivate
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Page ─── */
export default function AdminUsers() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [showInactive, setShowInactive] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [resetPwUser, setResetPwUser] = useState<UserRow | null>(null);
  const { data: users, isLoading } = useUsers(showInactive);

  const deactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('profiles').update({ is_active: false }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_, userId) => {
      toast({ title: 'User deactivated' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      logAudit('profiles', userId, 'UPDATE', { is_active: true }, { is_active: false });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('profiles').update({ is_active: true }).eq('id', userId);
      if (error) throw error;
    },
    onSuccess: (_, userId) => {
      toast({ title: 'User reactivated' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      logAudit('profiles', userId, 'UPDATE', { is_active: false }, { is_active: true });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const currentUserId = currentUser?.id ?? '';

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
          {users?.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              currentUserId={currentUserId}
              onDeactivate={(id) => deactivateMutation.mutate(id)}
              onReactivate={(id) => reactivateMutation.mutate(id)}
              onEdit={(u) => setEditingUser(u)}
              onResetPassword={(u) => setResetPwUser(u)}
            />
          ))}
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
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Reset Password" onClick={() => setResetPwUser(u)}><KeyRound className="h-4 w-4" /></Button>
                      {u.is_active && (
                        <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditingUser(u)}><Pencil className="h-4 w-4" /></Button>
                      )}
                      {u.is_active ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Deactivate"
                          className="text-destructive hover:text-destructive"
                          disabled={u.id === currentUserId}
                          onClick={() => deactivateMutation.mutate(u.id)}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reactivate"
                          onClick={() => reactivateMutation.mutate(u.id)}
                        >
                          <UserCheck className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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

      {editingUser && <EditUserDialog user={editingUser} onClose={() => setEditingUser(null)} />}
      {resetPwUser && <ResetPasswordDialog user={resetPwUser} onClose={() => setResetPwUser(null)} />}
    </div>
  );
}
