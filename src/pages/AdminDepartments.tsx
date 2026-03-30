import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Plus, Pencil, Building2, MapPin, Loader2, Trash2, Pause, Play, MoreVertical, EyeOff, Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Department = {
  id: string;
  name: string;
  code: string;
  display_order: number;
  is_active: boolean;
  factory_id: string;
  created_at: string;
};

// ── Hooks ──

function useFactory() {
  return useQuery({
    queryKey: ['factory'],
    queryFn: async () => {
      const { data, error } = await supabase.from('factory').select('*').limit(1).single();
      if (error) throw error;
      return data;
    },
  });
}

function useDepartments() {
  return useQuery({
    queryKey: ['admin-departments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('department').select('*').order('display_order');
      if (error) throw error;
      return data;
    },
  });
}

// ── Edit Factory Dialog (unchanged) ──

function EditFactoryDialog({ factory }: { factory: { id: string; name: string; code: string; location: string | null } }) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: factory.name, code: factory.code, location: factory.location || '' });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('factory').update({ name: form.name, code: form.code, location: form.location || null }).eq('id', factory.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Factory updated' });
      queryClient.invalidateQueries({ queryKey: ['factory'] });
      setOpen(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1"><Pencil className="h-3 w-3" /> Edit</Button>
      </DialogTrigger>
      <DialogContent className={isMobile ? 'h-full max-h-full w-full max-w-full rounded-none' : ''}>
        <DialogHeader><DialogTitle>Edit Factory</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="h-11" /></div>
          <div className="space-y-2"><Label>Code</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required className="h-11" /></div>
          <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} className="h-11" /></div>
          <Button type="submit" className="w-full h-11" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Add Department Dialog (unchanged) ──

function AddDeptDialog({ factoryId }: { factoryId: string }) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', display_order: 0 });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('department').insert({ factory_id: factoryId, name: form.name, code: form.code, display_order: form.display_order });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Department added' });
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      setOpen(false);
      setForm({ name: '', code: '', display_order: 0 });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={isMobile ? 'default' : 'sm'} className="gap-1.5"><Plus className="h-4 w-4" /> Add Department</Button>
      </DialogTrigger>
      <DialogContent className={isMobile ? 'h-full max-h-full w-full max-w-full rounded-none' : ''}>
        <DialogHeader><DialogTitle>Add Department</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="h-11" /></div>
          <div className="space-y-2"><Label>Code *</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required className="h-11" /></div>
          <div className="space-y-2"><Label>Display Order</Label><Input type="number" value={form.display_order} onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className="h-11" /></div>
          <Button type="submit" className="w-full h-11" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Department
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Department Dialog ──

function EditDeptDialog({ dept, open, onOpenChange }: { dept: Department; open: boolean; onOpenChange: (v: boolean) => void }) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: dept.name, code: dept.code, display_order: dept.display_order });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('department')
        .update({ name: form.name, code: form.code, display_order: form.display_order })
        .eq('id', dept.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Department updated' });
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isMobile ? 'h-full max-h-full w-full max-w-full rounded-none' : ''}>
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
          <DialogDescription>Update department details below.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="h-11" />
          </div>
          <div className="space-y-2">
            <Label>Code *</Label>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required className="h-11" />
            <p className="text-xs text-muted-foreground">Used as a short identifier. Change with caution.</p>
          </div>
          <div className="space-y-2">
            <Label>Display Order</Label>
            <Input type="number" value={form.display_order} onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))} className="h-11" />
          </div>
          <Button type="submit" className="w-full h-11" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Department Actions Hook ──

function useDeptActions() {
  const queryClient = useQueryClient();

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('department').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Department deactivated' });
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const reactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('department').update({ is_active: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Department reactivated' });
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('department').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Department deleted' });
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const checkDependencies = async (deptId: string) => {
    const [usersRes, kpisRes, tasksRes] = await Promise.all([
      supabase.from('user_departments').select('id', { count: 'exact', head: true }).eq('department_id', deptId),
      supabase.from('kpi_master').select('id', { count: 'exact', head: true }).eq('department_id', deptId),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('department_id', deptId),
    ]);
    return {
      users: usersRes.count ?? 0,
      kpis: kpisRes.count ?? 0,
      tasks: tasksRes.count ?? 0,
    };
  };

  return { deactivateMutation, reactivateMutation, deleteMutation, checkDependencies };
}

// ── Department Row Actions (desktop icon buttons) ──

function DeptRowActions({ dept, isAdmin }: { dept: Department; isAdmin: boolean }) {
  const { deactivateMutation, reactivateMutation, deleteMutation, checkDependencies } = useDeptActions();
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<
    | { type: 'idle' }
    | { type: 'checking' }
    | { type: 'blocked'; users: number; kpis: number; tasks: number }
    | { type: 'confirm' }
  >({ type: 'idle' });

  if (!isAdmin) return null;

  const handleDeleteClick = async () => {
    setDeleteState({ type: 'checking' });
    const deps = await checkDependencies(dept.id);
    if (deps.users > 0 || deps.kpis > 0 || deps.tasks > 0) {
      setDeleteState({ type: 'blocked', ...deps });
    } else {
      setDeleteState({ type: 'confirm' });
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {dept.is_active ? (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-600" onClick={() => setDeactivateOpen(true)} title="Deactivate">
            <Pause className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-500 hover:text-emerald-600" onClick={() => reactivateMutation.mutate(dept.id)} title="Reactivate">
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleDeleteClick} title="Delete">
          {deleteState.type === 'checking' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <EditDeptDialog dept={dept} open={editOpen} onOpenChange={setEditOpen} />

      {/* Deactivate confirmation */}
      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {dept.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This department will be hidden from KPI entry, meeting views, and user assignment.
              Existing data is preserved. You can reactivate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => deactivateMutation.mutate(dept.id)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete blocked dialog */}
      <AlertDialog open={deleteState.type === 'blocked'} onOpenChange={(v) => !v && setDeleteState({ type: 'idle' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot delete {dept.name}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This department has existing data:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {deleteState.type === 'blocked' && deleteState.users > 0 && <li>{deleteState.users} users assigned</li>}
                  {deleteState.type === 'blocked' && deleteState.kpis > 0 && <li>{deleteState.kpis} KPIs defined</li>}
                  {deleteState.type === 'blocked' && deleteState.tasks > 0 && <li>{deleteState.tasks} tasks linked</li>}
                </ul>
                <p>To remove this department from active use, deactivate it instead. Deactivating preserves all historical data.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>OK</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => {
                setDeleteState({ type: 'idle' });
                deactivateMutation.mutate(dept.id);
              }}
            >
              Deactivate Instead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm dialog */}
      <AlertDialog open={deleteState.type === 'confirm'} onOpenChange={(v) => !v && setDeleteState({ type: 'idle' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {dept.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This department has no data and will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteMutation.mutate(dept.id)}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Mobile Actions Sheet ──

function MobileDeptActions({ dept, isAdmin }: { dept: Department; isAdmin: boolean }) {
  const { deactivateMutation, reactivateMutation, deleteMutation, checkDependencies } = useDeptActions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteState, setDeleteState] = useState<
    | { type: 'idle' }
    | { type: 'checking' }
    | { type: 'blocked'; users: number; kpis: number; tasks: number }
    | { type: 'confirm' }
  >({ type: 'idle' });

  if (!isAdmin) return null;

  const handleDeleteClick = async () => {
    setSheetOpen(false);
    setDeleteState({ type: 'checking' });
    const deps = await checkDependencies(dept.id);
    if (deps.users > 0 || deps.kpis > 0 || deps.tasks > 0) {
      setDeleteState({ type: 'blocked', ...deps });
    } else {
      setDeleteState({ type: 'confirm' });
    }
  };

  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSheetOpen(true)}>
        <MoreVertical className="h-4 w-4" />
      </Button>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{dept.name}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 py-4">
            <Button
              variant="outline"
              className="justify-start gap-2"
              onClick={() => { setSheetOpen(false); setEditOpen(true); }}
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {dept.is_active ? (
              <Button
                variant="outline"
                className="justify-start gap-2 text-amber-500 border-amber-200"
                onClick={() => { setSheetOpen(false); setDeactivateOpen(true); }}
              >
                <Pause className="h-4 w-4" /> Deactivate
              </Button>
            ) : (
              <Button
                variant="outline"
                className="justify-start gap-2 text-emerald-500 border-emerald-200"
                onClick={() => { setSheetOpen(false); reactivateMutation.mutate(dept.id); }}
              >
                <Play className="h-4 w-4" /> Reactivate
              </Button>
            )}
            <Button
              variant="outline"
              className="justify-start gap-2 text-destructive border-destructive/30"
              onClick={handleDeleteClick}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <EditDeptDialog dept={dept} open={editOpen} onOpenChange={setEditOpen} />

      {/* Deactivate confirmation */}
      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {dept.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This department will be hidden from KPI entry, meeting views, and user assignment.
              Existing data is preserved. You can reactivate it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => deactivateMutation.mutate(dept.id)}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete blocked */}
      <AlertDialog open={deleteState.type === 'blocked'} onOpenChange={(v) => !v && setDeleteState({ type: 'idle' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cannot delete {dept.name}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This department has existing data:</p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {deleteState.type === 'blocked' && deleteState.users > 0 && <li>{deleteState.users} users assigned</li>}
                  {deleteState.type === 'blocked' && deleteState.kpis > 0 && <li>{deleteState.kpis} KPIs defined</li>}
                  {deleteState.type === 'blocked' && deleteState.tasks > 0 && <li>{deleteState.tasks} tasks linked</li>}
                </ul>
                <p>To remove this department from active use, deactivate it instead. Deactivating preserves all historical data.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>OK</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => { setDeleteState({ type: 'idle' }); deactivateMutation.mutate(dept.id); }}
            >
              Deactivate Instead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteState.type === 'confirm'} onOpenChange={(v) => !v && setDeleteState({ type: 'idle' })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {dept.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This department has no data and will be permanently deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => deleteMutation.mutate(dept.id)}
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ── Main Page ──

export default function AdminDepartments() {
  const isMobile = useIsMobile();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('super_admin');
  const { data: factory, isLoading: factoryLoading } = useFactory();
  const { data: departments, isLoading: deptsLoading } = useDepartments();
  const [hideInactive, setHideInactive] = useState(false);

  const filteredDepts = departments?.filter((d) => !hideInactive || d.is_active);

  if (factoryLoading || deptsLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-foreground md:text-2xl">Departments</h1>

      {/* Factory Info */}
      {factory && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4" /> Factory</CardTitle>
              {isAdmin && <EditFactoryDialog factory={factory} />}
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium">{factory.name}</p>
            <p className="text-xs text-muted-foreground">Code: {factory.code}</p>
            {factory.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{factory.location}</p>}
          </CardContent>
        </Card>
      )}

      {/* Department List Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Department List</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setHideInactive((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {hideInactive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {hideInactive ? 'Show inactive' : 'Hide inactive'}
          </button>
          {factory && isAdmin && <AddDeptDialog factoryId={factory.id} />}
        </div>
      </div>

      {/* Mobile Layout */}
      {isMobile ? (
        <div className="space-y-3">
          {filteredDepts?.map((d) => (
            <Card key={d.id} className={cn(!d.is_active && 'opacity-50')}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{d.name}</p>
                    {!d.is_active && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">Code: {d.code} · Order: {d.display_order}</p>
                </div>
                <MobileDeptActions dept={d} isAdmin={isAdmin} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* Desktop Layout */
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Display Order</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDepts?.map((d) => (
                <TableRow key={d.id} className={cn(!d.is_active && 'opacity-50')}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.code}</TableCell>
                  <TableCell>{d.display_order}</TableCell>
                  <TableCell>
                    <Badge variant={d.is_active ? 'default' : 'outline'}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <DeptRowActions dept={d} isAdmin={isAdmin} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
