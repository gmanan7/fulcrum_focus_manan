import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DB } from '@/integrations/apiClient';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, Loader2, Save, AlertTriangle, Plus, MoreVertical, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/DB/types';
import { logAudit } from '@/lib/auditLog';
import { formatIndianNumber } from '@/lib/formatNumber';
import { getMaxEntryDate, showTodayWarning } from '@/lib/dispatchEntry';

type RagStatus = Database['public']['Enums']['rag_status'];
type KpiDirection = Database['public']['Enums']['kpi_direction'];
type ProjectItemStatus = Database['public']['Enums']['project_item_status'];

const RAG_COLORS: Record<RagStatus, string> = {
  green: 'bg-rag-green text-success-foreground',
  amber: 'bg-rag-amber text-warning-foreground',
  red: 'bg-rag-red text-destructive-foreground',
};

const ITEM_STATUS_COLORS: Record<ProjectItemStatus, string> = {
  active: 'bg-primary/10 text-primary',
  completed: 'bg-success/10 text-success',
  on_hold: 'bg-warning/10 text-warning',
  dropped: 'bg-muted text-muted-foreground',
};

function computeRag(actual: number | null, greenRaw: number | null, amberRaw: number | null, direction: KpiDirection, target: number | null = null): RagStatus | null {
  if (actual == null) return null;
  // Fallback thresholds when not explicitly set
  let green = greenRaw;
  let amber = amberRaw;
  if (green == null && target != null) green = target;
  if (amber == null && target != null) {
    if (direction === 'higher_is_better') amber = target * 0.85;
    else if (direction === 'lower_is_better') amber = target * 1.15;
    else amber = target;
  }
  if (green == null || amber == null) return null;
  if (direction === 'higher_is_better') {
    if (actual >= green) return 'green';
    if (actual >= amber) return 'amber';
    return 'red';
  }
  if (direction === 'lower_is_better') {
    if (actual <= green) return 'green';
    if (actual <= amber) return 'amber';
    return 'red';
  }
  // target_is_exact
  if (actual === green) return 'green';
  const diff = Math.abs(actual - green);
  const amberRange = Math.abs(amber - green);
  if (diff <= amberRange) return 'amber';
  return 'red';
}

function useUserDepartments() {
  const { user, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole('super_admin', 'factory_manager');

  return useQuery({
    queryKey: ['user-departments', user?.id, isAdmin],
    queryFn: async () => {
      if (isAdmin) {
        const { data, error } = await DB.from('department').select('id, name, code').eq('is_active', true).order('display_order');
        if (error) throw error;
        return data;
      }
      const { data: deptIds } = await DB.rpc('get_user_departments', { p_user_id: user!.id });
      if (!deptIds || deptIds.length === 0) return [];
      const ids = deptIds.map((d: any) => d.department_id);
      const { data, error } = await DB.from('department').select('id, name, code').in('id', ids).eq('is_active', true).order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

interface KpiEntryState {
  kpi_id: string;
  actual_value: string;
  text_value: string;
  remarks: string;
  existing_id?: string;
}

function NumericDescriptiveSection({ departmentId, reportingDate }: { departmentId: string; reportingDate: string }) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const diffDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(reportingDate + 'T00:00:00');
    return Math.floor((today.getTime() - selected.getTime()) / (1000 * 60 * 60 * 24));
  }, [reportingDate]);
  const isLate = diffDays >= 2;

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['kpis-for-entry', departmentId],
    queryFn: async () => {
      const { data, error } = await DB
        .from('kpi_master')
        .select('*')
        .eq('department_id', departmentId)
        .eq('is_active', true)
        .in('kpi_type', ['numeric', 'descriptive'])
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: existingEntries } = useQuery({
    queryKey: ['kpi-entries', departmentId, reportingDate],
    queryFn: async () => {
      const kpiIds = kpis?.map((k) => k.id) || [];
      if (kpiIds.length === 0) return [];
      const { data, error } = await DB
        .from('kpi_entries')
        .select('*')
        .in('kpi_id', kpiIds)
        .eq('reporting_date', reportingDate);
      if (error) throw error;
      return data;
    },
    enabled: !!kpis && kpis.length > 0,
  });

  const [entries, setEntries] = useState<Record<string, KpiEntryState>>({});

  // Initialize entries when data loads
  useMemo(() => {
    if (!kpis) return;
    const newEntries: Record<string, KpiEntryState> = {};
    kpis.forEach((kpi) => {
      const existing = existingEntries?.find((e) => e.kpi_id === kpi.id);
      newEntries[kpi.id] = {
        kpi_id: kpi.id,
        actual_value: existing?.actual_value?.toString() || '',
        text_value: existing?.text_value || '',
        remarks: existing?.remarks || '',
        existing_id: existing?.id,
      };
    });
    setEntries(newEntries);
  }, [kpis, existingEntries]);

  const updateEntry = useCallback((kpiId: string, field: keyof KpiEntryState, value: string) => {
    setEntries((prev) => ({ ...prev, [kpiId]: { ...prev[kpiId], [field]: value } }));
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts = Object.values(entries).map((entry) => {
        const kpi = kpis?.find((k) => k.id === entry.kpi_id);
        if (!kpi) return null;

        const actualNum = entry.actual_value ? parseFloat(entry.actual_value) : null;
        const status = kpi.kpi_type === 'numeric'
          ? computeRag(actualNum, kpi.green_threshold as number | null, kpi.amber_threshold as number | null, kpi.direction, kpi.target_value as number | null)
          : null;

        return {
          kpi_id: entry.kpi_id,
          reporting_date: reportingDate,
          actual_value: actualNum,
          text_value: entry.text_value || null,
          computed_status: status,
          submitted_by: user!.id,
          is_late_entry: isLate,
          remarks: entry.remarks || null,
        };
      }).filter(Boolean);

      if (upserts.length === 0) return;

      const { error } = await DB.from('kpi_entries').upsert(
        upserts as any[],
        { onConflict: 'kpi_id,reporting_date' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `Saved at ${format(new Date(), 'h:mm a')}` });
      queryClient.invalidateQueries({ queryKey: ['kpi-entries'] });
      Object.values(entries).forEach((entry) => {
        if (entry.actual_value || entry.text_value) {
          logAudit('kpi_entries', entry.existing_id || entry.kpi_id, 'INSERT', null, { kpi_id: entry.kpi_id, reporting_date: reportingDate });
        }
      });
    },
    onError: (e: Error) => toast({ title: 'Error saving', description: e.message, variant: 'destructive' }),
  });

  if (kpisLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!kpis || kpis.length === 0) return <p className="text-sm text-muted-foreground py-4">No numeric/descriptive KPIs for this department.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">Numeric & Descriptive KPIs</h2>

      {isLate && (
        <div className="flex items-center gap-2 rounded-md bg-warning/10 p-3 text-sm text-warning">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Entering data for {diffDays} days ago — this will be marked as a late entry
        </div>
      )}

      {isMobile ? (
        <div className="space-y-3">
          {kpis.map((kpi) => {
            const entry = entries[kpi.id];
            if (!entry) return null;
            const isNumeric = kpi.kpi_type === 'numeric';
            const actualNum = entry.actual_value ? parseFloat(entry.actual_value) : null;
            const rag = isNumeric ? computeRag(actualNum, kpi.green_threshold as number | null, kpi.amber_threshold as number | null, kpi.direction, kpi.target_value as number | null) : null;

            return (
              <Card key={kpi.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{kpi.name}</p>
                      {isNumeric && kpi.target_value != null && (
                        <p className="text-xs text-muted-foreground">Target: {formatIndianNumber(kpi.target_value)} {kpi.unit || ''}</p>
                      )}
                    </div>
                    {rag && <Badge className={`text-xs ${RAG_COLORS[rag]}`}>{rag.toUpperCase()}</Badge>}
                  </div>
                  {isNumeric ? (
                    <Input
                      type="number"
                      step="any"
                      placeholder={`Enter value${kpi.unit ? ` (${kpi.unit})` : ''}`}
                      value={entry.actual_value}
                      onChange={(e) => updateEntry(kpi.id, 'actual_value', e.target.value)}
                      className="h-11"
                    />
                  ) : (
                    <Textarea
                      placeholder="Enter text update..."
                      value={entry.text_value}
                      onChange={(e) => updateEntry(kpi.id, 'text_value', e.target.value)}
                      rows={2}
                    />
                  )}
                  <Input
                    placeholder="Remarks (optional)"
                    value={entry.remarks}
                    onChange={(e) => updateEntry(kpi.id, 'remarks', e.target.value)}
                    className="h-10 text-sm"
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">KPI Name</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground w-24">Target</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground w-40">Actual / Value</th>
                <th className="text-center p-3 text-sm font-medium text-muted-foreground w-20">Status</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground w-48">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((kpi) => {
                const entry = entries[kpi.id];
                if (!entry) return null;
                const isNumeric = kpi.kpi_type === 'numeric';
                const actualNum = entry.actual_value ? parseFloat(entry.actual_value) : null;
                const rag = isNumeric ? computeRag(actualNum, kpi.green_threshold as number | null, kpi.amber_threshold as number | null, kpi.direction, kpi.target_value as number | null) : null;

                return (
                  <tr key={kpi.id} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="text-sm font-medium">{kpi.name}</p>
                      {kpi.unit && <p className="text-xs text-muted-foreground">{kpi.unit}</p>}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">{isNumeric ? (kpi.target_value ?? '—') : '—'}</td>
                    <td className="p-3">
                      {isNumeric ? (
                        <Input
                          type="number"
                          step="any"
                          value={entry.actual_value}
                          onChange={(e) => updateEntry(kpi.id, 'actual_value', e.target.value)}
                          className="h-9"
                        />
                      ) : (
                        <Textarea
                          value={entry.text_value}
                          onChange={(e) => updateEntry(kpi.id, 'text_value', e.target.value)}
                          rows={1}
                          className="min-h-[2.25rem] resize-none"
                        />
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {rag ? <Badge className={`text-xs ${RAG_COLORS[rag]}`}>{rag.toUpperCase()}</Badge> : <span className="text-xs text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3">
                      <Input value={entry.remarks} onChange={(e) => updateEntry(kpi.id, 'remarks', e.target.value)} className="h-9 text-sm" placeholder="Remarks" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Sticky Save Button */}
      <div className={cn('flex justify-end', isMobile && 'sticky bottom-0 -mx-4 bg-background border-t p-4')}>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className={cn('gap-2', isMobile && 'w-full h-12')}>
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save All
        </Button>
      </div>
    </div>
  );
}

// Project Tracker Section
function ProjectTrackerSection({ departmentId, reportingDate }: { departmentId: string; reportingDate: string }) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [hideCompleted, setHideCompleted] = useState(false);

  const { data: trackerKpis } = useQuery({
    queryKey: ['tracker-kpis', departmentId],
    queryFn: async () => {
      const { data, error } = await DB
        .from('kpi_master')
        .select('id, name')
        .eq('department_id', departmentId)
        .eq('is_active', true)
        .eq('kpi_type', 'project_tracker')
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  if (!trackerKpis || trackerKpis.length === 0) return null;

  return (
    <div className="space-y-6 mt-6 border-t pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Project Tracker KPIs</h2>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} className="rounded" />
          Hide completed
        </label>
      </div>

      {trackerKpis.map((kpi) => (
        <TrackerKpiSection key={kpi.id} kpiId={kpi.id} kpiName={kpi.name} departmentId={departmentId} reportingDate={reportingDate} hideCompleted={hideCompleted} />
      ))}
    </div>
  );
}

function TrackerKpiSection({ kpiId, kpiName, departmentId, reportingDate, hideCompleted }: {
  kpiId: string; kpiName: string; departmentId: string; reportingDate: string; hideCompleted: boolean;
}) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddItem, setShowAddItem] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data: items } = useQuery({
    queryKey: ['tracker-items', kpiId],
    queryFn: async () => {
      const { data, error } = await DB
        .from('project_tracker_items')
        .select('*')
        .eq('kpi_id', kpiId)
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async () => {
      const { error } = await DB.from('project_tracker_items').insert({
        kpi_id: kpiId,
        department_id: departmentId,
        title: newTitle,
        description: newDesc || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Item added' });
      queryClient.invalidateQueries({ queryKey: ['tracker-items', kpiId] });
      setShowAddItem(false);
      setNewTitle('');
      setNewDesc('');
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProjectItemStatus }) => {
      const { error } = await DB.from('project_tracker_items').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tracker-items', kpiId] }),
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await DB.from('project_tracker_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Item deleted' });
      queryClient.invalidateQueries({ queryKey: ['tracker-items', kpiId] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const filteredItems = hideCompleted ? items?.filter((i) => i.status !== 'completed') : items;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{kpiName}</h3>
        <Button variant="outline" size="sm" className="gap-1 h-8" onClick={() => setShowAddItem(true)}>
          <Plus className="h-3 w-3" /> Add Item
        </Button>
      </div>

      {/* Add Item Form */}
      {showAddItem && (
        <Card>
          <CardContent className="p-3 space-y-3">
            <Input placeholder="Title *" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-10" />
            <Input placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="h-10" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addItemMutation.mutate()} disabled={!newTitle || addItemMutation.isPending} className="h-9">
                {addItemMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />} Add
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowAddItem(false)} className="h-9">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {filteredItems?.map((item) => (
          <TrackerItemCard
            key={item.id}
            item={item}
            reportingDate={reportingDate}
            onStatusChange={(status) => statusMutation.mutate({ id: item.id, status })}
            onDelete={() => deleteMutation.mutate(item.id)}
          />
        ))}
        {filteredItems?.length === 0 && <p className="text-xs text-muted-foreground py-2">No items yet.</p>}
      </div>
    </div>
  );
}

function TrackerItemCard({ item, reportingDate, onStatusChange, onDelete }: {
  item: any;
  reportingDate: string;
  onStatusChange: (status: ProjectItemStatus) => void;
  onDelete: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [stageName, setStageName] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [showAllUpdates, setShowAllUpdates] = useState(false);

  const { data: updates } = useQuery({
    queryKey: ['stage-updates', item.id],
    queryFn: async () => {
      const { data, error } = await DB
        .from('project_item_stage_updates')
        .select('*, profiles:updated_by(full_name)')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await DB.from('project_item_stage_updates').insert({
        item_id: item.id,
        stage_name: stageName,
        update_note: updateNote || null,
        reporting_date: reportingDate,
        updated_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Update added' });
      queryClient.invalidateQueries({ queryKey: ['stage-updates', item.id] });
      setShowUpdateForm(false);
      setStageName('');
      setUpdateNote('');
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const isCompleted = item.status === 'completed';
  const visibleUpdates = showAllUpdates ? updates : updates?.slice(0, 2);
  const statusOptions: ProjectItemStatus[] = ['active', 'completed', 'on_hold', 'dropped'].filter((s) => s !== item.status) as ProjectItemStatus[];

  return (
    <Card className={isCompleted ? 'opacity-60' : ''}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium', isCompleted && 'line-through')}>{item.title}</p>
            {item.description && <p className="text-xs text-muted-foreground truncate">{item.description}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Badge className={`text-xs ${ITEM_STATUS_COLORS[item.status as ProjectItemStatus]}`}>
              {item.status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-3.5 w-3.5" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {statusOptions.map((s) => (
                  <DropdownMenuItem key={s} onClick={() => onStatusChange(s)}>
                    Set {s.replace('_', ' ')}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem className="text-destructive" onClick={onDelete}>Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Add Update */}
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs w-full" onClick={() => setShowUpdateForm(true)}>
          <Plus className="h-3 w-3" /> Add Update
        </Button>

        {showUpdateForm && (
          <div className="space-y-2 p-2 bg-muted/30 rounded-md">
            <Input placeholder="Stage name *" value={stageName} onChange={(e) => setStageName(e.target.value)} className="h-9 text-sm" />
            <Input placeholder="Note (optional)" value={updateNote} onChange={(e) => setUpdateNote(e.target.value)} className="h-9 text-sm" />
            <div className="flex gap-2">
              <Button size="sm" className="h-8" onClick={() => addUpdateMutation.mutate()} disabled={!stageName || addUpdateMutation.isPending}>Add</Button>
              <Button variant="outline" size="sm" className="h-8" onClick={() => setShowUpdateForm(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Recent Updates */}
        {visibleUpdates && visibleUpdates.length > 0 && (
          <div className="space-y-1">
            {visibleUpdates.map((u: any) => (
              <div key={u.id} className="text-xs border-l-2 border-primary/30 pl-2 py-0.5">
                <span className="font-medium">{u.stage_name}</span>
                {u.update_note && <span className="text-muted-foreground"> — {u.update_note}</span>}
                <span className="text-muted-foreground block">{format(new Date(u.created_at), 'PP')} · {u.profiles?.full_name}</span>
              </div>
            ))}
            {updates && updates.length > 2 && !showAllUpdates && (
              <button className="text-xs text-primary underline" onClick={() => setShowAllUpdates(true)}>Show all ({updates.length})</button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function KpiEntry() {
  const [date, setDate] = useState<Date>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });
  const [selectedDept, setSelectedDept] = useState<string>('');
  const { data: departments, isLoading: deptsLoading } = useUserDepartments();
  const deptCodes = useMemo(() => (departments?.map((d: any) => d.code) ?? []), [departments]);
  const maxEntryDate = useMemo(() => getMaxEntryDate(deptCodes), [deptCodes]);
  const showDispatchTodayHint = showTodayWarning(date, deptCodes);

  // Auto-select if only one department
  useMemo(() => {
    if (departments && departments.length === 1 && !selectedDept) {
      setSelectedDept(departments[0].id);
    }
  }, [departments, selectedDept]);

  const reportingDate = format(date, 'yyyy-MM-dd');

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-foreground md:text-2xl">Enter KPIs</h1>

      {/* Header Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <Label className="text-sm">Reporting Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-11 w-full sm:w-48 justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(date, 'PPP')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} disabled={(d) => d > maxEntryDate} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">Reporting date — defaults to yesterday. T4 reviews cover the previous day's performance.</p>
          {showDispatchTodayHint && (
            <p className="text-xs text-warning">Today's entry — will appear in tomorrow's dashboard review</p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-sm">Department</Label>
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="h-11 w-full sm:w-56"><SelectValue placeholder="Select department" /></SelectTrigger>
            <SelectContent>
              {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {!selectedDept ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Select a department to begin entering KPIs.</p>
      ) : (
        <>
          <NumericDescriptiveSection departmentId={selectedDept} reportingDate={reportingDate} />
          <ProjectTrackerSection departmentId={selectedDept} reportingDate={reportingDate} />
        </>
      )}
    </div>
  );
}
