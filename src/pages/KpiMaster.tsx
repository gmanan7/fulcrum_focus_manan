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
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type KpiType = Database['public']['Enums']['kpi_type'];
type KpiFrequency = Database['public']['Enums']['kpi_frequency'];
type KpiDirection = Database['public']['Enums']['kpi_direction'];

const TYPE_LABELS: Record<KpiType, string> = { numeric: 'Numeric', descriptive: 'Descriptive', project_tracker: 'Project Tracker' };
const FREQ_LABELS: Record<KpiFrequency, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const DIR_LABELS: Record<KpiDirection, string> = { higher_is_better: 'Higher is Better', lower_is_better: 'Lower is Better', target_is_exact: 'Target is Exact' };

interface KpiForm {
  id?: string;
  department_id: string;
  name: string;
  kpi_type: KpiType;
  description: string;
  display_order: number;
  unit: string;
  frequency: KpiFrequency;
  direction: KpiDirection;
  target_value: string;
  green_threshold: string;
  amber_threshold: string;
}

const emptyForm: KpiForm = {
  department_id: '', name: '', kpi_type: 'numeric', description: '', display_order: 0,
  unit: '', frequency: 'daily', direction: 'higher_is_better', target_value: '', green_threshold: '', amber_threshold: '',
};

function useDepartments() {
  return useQuery({
    queryKey: ['departments-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('department').select('id, name, code').eq('is_active', true).order('display_order');
      if (error) throw error;
      return data;
    },
  });
}

function useKpis(deptFilter: string) {
  return useQuery({
    queryKey: ['kpi-master', deptFilter],
    queryFn: async () => {
      let q = supabase.from('kpi_master').select('*, department:department_id(name)').order('display_order');
      if (deptFilter !== 'all') q = q.eq('department_id', deptFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

function KpiFormDialog({ initial, departments, onClose }: { initial?: KpiForm; departments: { id: string; name: string; code: string }[]; onClose: () => void }) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<KpiForm>(initial || emptyForm);
  const isEdit = !!initial?.id;

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        department_id: form.department_id,
        name: form.name,
        kpi_type: form.kpi_type,
        description: form.description || null,
        display_order: form.display_order,
      };

      if (form.kpi_type === 'numeric') {
        payload.unit = form.unit || null;
        payload.frequency = form.frequency;
        payload.direction = form.direction;
        payload.target_value = form.target_value ? parseFloat(form.target_value) : null;
        payload.green_threshold = form.green_threshold ? parseFloat(form.green_threshold) : null;
        payload.amber_threshold = form.amber_threshold ? parseFloat(form.amber_threshold) : null;
      } else if (form.kpi_type === 'descriptive') {
        payload.frequency = form.frequency;
        payload.unit = null;
        payload.target_value = null;
        payload.green_threshold = null;
        payload.amber_threshold = null;
        payload.direction = 'higher_is_better';
      } else {
        payload.frequency = 'daily';
        payload.unit = null;
        payload.target_value = null;
        payload.green_threshold = null;
        payload.amber_threshold = null;
        payload.direction = 'higher_is_better';
      }

      if (isEdit) {
        const { error } = await supabase.from('kpi_master').update(payload).eq('id', form.id!);
        if (error) throw error;
        try { await logAudit('kpi_master', form.id!, 'UPDATE', null, payload); } catch (e) { console.warn('Audit log failed:', e); }
      } else {
        const { data: inserted, error } = await supabase.from('kpi_master').insert(payload).select('id').single();
        if (error) throw error;
        try { await logAudit('kpi_master', inserted.id, 'INSERT', null, payload); } catch (e) { console.warn('Audit log failed:', e); }
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'KPI updated' : 'KPI created' });
      queryClient.invalidateQueries({ queryKey: ['kpi-master'] });
      onClose();
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const set = (key: keyof KpiForm, val: any) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <DialogContent className={isMobile ? 'h-full max-h-full w-full max-w-full rounded-none' : 'max-w-lg'}>
      <DialogHeader><DialogTitle>{isEdit ? 'Edit KPI' : 'Add KPI'}</DialogTitle></DialogHeader>
      <form className="space-y-4 overflow-y-auto max-h-[calc(100dvh-8rem)] md:max-h-[70vh]" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        {/* Basic Info */}
        <div className="space-y-2">
          <Label>Department *</Label>
          <Select value={form.department_id} onValueChange={(v) => set('department_id', v)}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>KPI Name *</Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label>KPI Type *</Label>
          <RadioGroup value={form.kpi_type} onValueChange={(v) => set('kpi_type', v)} className="flex gap-4">
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-2 cursor-pointer min-h-[2.75rem]">
                <RadioGroupItem value={k} /><span className="text-sm">{v}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Display Order</Label>
          <Input type="number" value={form.display_order} onChange={(e) => set('display_order', parseInt(e.target.value) || 0)} className="h-11" />
        </div>

        {/* Numeric Section */}
        {form.kpi_type === 'numeric' && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-semibold text-foreground">Numeric Settings</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="%, Nos, kg" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => set('frequency', v)}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={(v) => set('direction', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DIR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Target</Label><Input type="number" step="any" value={form.target_value} onChange={(e) => set('target_value', e.target.value)} className="h-11" /></div>
              <div className="space-y-2"><Label>Green ≥</Label><Input type="number" step="any" value={form.green_threshold} onChange={(e) => set('green_threshold', e.target.value)} className="h-11" /></div>
              <div className="space-y-2"><Label>Amber ≥</Label><Input type="number" step="any" value={form.amber_threshold} onChange={(e) => set('amber_threshold', e.target.value)} className="h-11" /></div>
            </div>
          </div>
        )}

        {/* Descriptive Section */}
        {form.kpi_type === 'descriptive' && (
          <div className="space-y-4 border-t pt-4">
            <p className="text-sm font-semibold text-foreground">Descriptive Settings</p>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => set('frequency', v)}>
                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(FREQ_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">This KPI accepts text updates only. No numeric targets.</p>
          </div>
        )}

        {/* Project Tracker Section */}
        {form.kpi_type === 'project_tracker' && (
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground">This KPI tracks individual jobs/projects through stages. No numeric targets. Updates are on-demand.</p>
          </div>
        )}

        <Button type="submit" className="w-full h-11" disabled={mutation.isPending || !form.department_id || !form.name}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create KPI'}
        </Button>
      </form>
    </DialogContent>
  );
}

export default function KpiMaster() {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [deptFilter, setDeptFilter] = useState('all');
  const [editKpi, setEditKpi] = useState<KpiForm | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { data: departments } = useDepartments();
  const { data: kpis, isLoading } = useKpis(deptFilter);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check for entries
      const { count } = await supabase.from('kpi_entries').select('id', { count: 'exact', head: true }).eq('kpi_id', id);
      if (count && count > 0) {
        const deactivate = confirm('This KPI has entries. Deactivate instead of deleting?');
        if (deactivate) {
          const { error } = await supabase.from('kpi_master').update({ is_active: false }).eq('id', id);
          if (error) throw error;
          return;
        }
        throw new Error('Cannot delete KPI with existing entries');
      }
      const { error } = await supabase.from('kpi_master').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'KPI removed' });
      queryClient.invalidateQueries({ queryKey: ['kpi-master'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openEdit = (kpi: any) => {
    setEditKpi({
      id: kpi.id,
      department_id: kpi.department_id,
      name: kpi.name,
      kpi_type: kpi.kpi_type,
      description: kpi.description || '',
      display_order: kpi.display_order,
      unit: kpi.unit || '',
      frequency: kpi.frequency,
      direction: kpi.direction,
      target_value: kpi.target_value?.toString() || '',
      green_threshold: kpi.green_threshold?.toString() || '',
      amber_threshold: kpi.amber_threshold?.toString() || '',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-foreground md:text-2xl">KPI Master</h1>
        <div className="flex items-center gap-3">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="h-10 w-full sm:w-48"><SelectValue placeholder="Filter by department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size={isMobile ? 'default' : 'sm'} className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Add KPI</Button>
            </DialogTrigger>
            {showCreate && departments && <KpiFormDialog departments={departments} onClose={() => setShowCreate(false)} />}
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : isMobile ? (
        <div className="space-y-3">
          {kpis?.map((kpi: any) => (
            <Card key={kpi.id} className={!kpi.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{kpi.name}</p>
                    <p className="text-xs text-muted-foreground">{kpi.department?.name}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">{TYPE_LABELS[kpi.kpi_type as KpiType]}</Badge>
                </div>
                <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {kpi.unit && <span>Unit: {kpi.unit}</span>}
                  {kpi.target_value != null && <span>· Target: {kpi.target_value}</span>}
                  <span>· {FREQ_LABELS[kpi.frequency as KpiFrequency]}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => openEdit(kpi)}><Pencil className="h-3 w-3" /> Edit</Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1 text-destructive" onClick={() => deleteMutation.mutate(kpi.id)}><Trash2 className="h-3 w-3" /> Delete</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {kpis?.length === 0 && <p className="text-center py-8 text-muted-foreground">No KPIs found</p>}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KPI Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpis?.map((kpi: any) => (
                <TableRow key={kpi.id} className={!kpi.is_active ? 'opacity-60' : ''}>
                  <TableCell className="font-medium">{kpi.name}</TableCell>
                  <TableCell className="text-muted-foreground">{kpi.department?.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{TYPE_LABELS[kpi.kpi_type as KpiType]}</Badge></TableCell>
                  <TableCell>{kpi.unit || '—'}</TableCell>
                  <TableCell>{kpi.target_value ?? '—'}</TableCell>
                  <TableCell>{FREQ_LABELS[kpi.frequency as KpiFrequency]}</TableCell>
                  <TableCell><Badge variant={kpi.is_active ? 'default' : 'outline'}>{kpi.is_active ? 'Yes' : 'No'}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(kpi)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(kpi.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {kpis?.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No KPIs found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editKpi} onOpenChange={() => setEditKpi(null)}>
        {editKpi && departments && <KpiFormDialog initial={editKpi} departments={departments} onClose={() => setEditKpi(null)} />}
      </Dialog>
    </div>
  );
}
