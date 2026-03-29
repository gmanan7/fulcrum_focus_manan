import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Building2, MapPin, Loader2 } from 'lucide-react';

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

export default function AdminDepartments() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { data: factory, isLoading: factoryLoading } = useFactory();
  const { data: departments, isLoading: deptsLoading } = useDepartments();

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('department').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-departments'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

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
              <EditFactoryDialog factory={factory} />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm font-medium">{factory.name}</p>
            <p className="text-xs text-muted-foreground">Code: {factory.code}</p>
            {factory.location && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{factory.location}</p>}
          </CardContent>
        </Card>
      )}

      {/* Departments */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Department List</h2>
        {factory && <AddDeptDialog factoryId={factory.id} />}
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {departments?.map((d) => (
            <Card key={d.id} className={!d.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">Code: {d.code} · Order: {d.display_order}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={d.is_active ? 'default' : 'outline'}>{d.is_active ? 'Active' : 'Inactive'}</Badge>
                  <Switch checked={d.is_active} onCheckedChange={(checked) => toggleMutation.mutate({ id: d.id, is_active: checked })} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Display Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments?.map((d) => (
                <TableRow key={d.id} className={!d.is_active ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.code}</TableCell>
                  <TableCell>{d.display_order}</TableCell>
                  <TableCell><Badge variant={d.is_active ? 'default' : 'outline'}>{d.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Switch checked={d.is_active} onCheckedChange={(checked) => toggleMutation.mutate({ id: d.id, is_active: checked })} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
