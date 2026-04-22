import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Settings, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PmMachine, PmPlan, PmActual } from '@/types/pm';
import {
  toIsoDate, daysOfMonth, daysBetween, getCellState, groupMachinesByGroup,
  filterMachinesByLine, filterMachinesByCriticality, validateNewMachine,
  type LineFilter, type CriticalityFilter, type CellState,
} from '@/lib/pmSchedule';
import { Plus } from 'lucide-react';

type Mode = 'plan' | 'actual';

interface RemarksDialogState {
  machine: PmMachine;
  date: string;
  existingActual: PmActual | null;
}

export default function PmSchedule() {
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();

  const [refDate, setRefDate] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [mode, setMode] = useState<Mode>('plan');
  const [lineFilter, setLineFilter] = useState<LineFilter>('All');
  const [critFilter, setCritFilter] = useState<CriticalityFilter>('All');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [remarksDialog, setRemarksDialog] = useState<RemarksDialogState | null>(null);
  const [remarksText, setRemarksText] = useState('');
  const [manageOpen, setManageOpen] = useState(false);

  const isAdmin = hasAnyRole('super_admin', 'factory_manager');
  const canEditPlan = hasAnyRole('super_admin', 'factory_manager', 'department_head');
  const canEditActual = canEditPlan; // engineering team_member additional check via dept handled by RLS

  const today = useMemo(() => toIsoDate(new Date()), []);
  const monthDays = useMemo(() => daysOfMonth(refDate), [refDate]);
  const monthStart = monthDays[0] ? toIsoDate(monthDays[0]) : '';
  const monthEnd = monthDays[monthDays.length - 1] ? toIsoDate(monthDays[monthDays.length - 1]) : '';

  // ---------- Queries ----------
  const machinesQuery = useQuery({
    queryKey: ['pm_machines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pm_machines')
        .select('*')
        .eq('is_active', true)
        .order('line').order('group_name').order('display_order');
      if (error) throw error;
      return (data ?? []) as PmMachine[];
    },
  });

  const plansQuery = useQuery({
    queryKey: ['pm_plan', monthStart, monthEnd],
    enabled: !!monthStart,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pm_plan')
        .select('*')
        .gte('planned_date', monthStart)
        .lte('planned_date', monthEnd);
      if (error) throw error;
      return (data ?? []) as PmPlan[];
    },
  });

  const actualsQuery = useQuery({
    queryKey: ['pm_actual', monthStart, monthEnd],
    enabled: !!monthStart,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pm_actual')
        .select('*')
        .gte('actual_date', monthStart)
        .lte('actual_date', monthEnd);
      if (error) throw error;
      return (data ?? []) as PmActual[];
    },
  });

  const machines = machinesQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const actuals = actualsQuery.data ?? [];

  // ---------- Filtering & grouping ----------
  const visibleMachines = useMemo(() => {
    return filterMachinesByCriticality(filterMachinesByLine(machines, lineFilter), critFilter);
  }, [machines, lineFilter, critFilter]);

  const grouped = useMemo(() => groupMachinesByGroup(visibleMachines), [visibleMachines]);

  // index plans/actuals by machineId|date for O(1) lookup
  const planMap = useMemo(() => {
    const m = new Map<string, PmPlan>();
    for (const p of plans) m.set(`${p.machine_id}|${p.planned_date}`, p);
    return m;
  }, [plans]);

  const actualMap = useMemo(() => {
    const m = new Map<string, PmActual>();
    for (const a of actuals) m.set(`${a.machine_id}|${a.actual_date}`, a);
    return m;
  }, [actuals]);

  // For each machine: nearest plan that aligns to a given actual_date, used to layer
  // actuals on plan cells when the actual happened on the plan date itself.
  const planByMachineDate = planMap;

  // ---------- Mutations ----------
  const togglePlanMutation = useMutation({
    mutationFn: async ({ machine, date }: { machine: PmMachine; date: string }) => {
      const existing = planMap.get(`${machine.id}|${date}`);
      if (existing) {
        const { error } = await supabase.from('pm_plan').delete().eq('id', existing.id);
        if (error) throw error;
        return { action: 'deleted' as const };
      }
      const { error } = await supabase.from('pm_plan').insert({
        machine_id: machine.id,
        planned_date: date,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
      return { action: 'created' as const };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm_plan', monthStart, monthEnd] });
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to update plan'),
  });

  const upsertActualMutation = useMutation({
    mutationFn: async ({ machine, date, remarks }: { machine: PmMachine; date: string; remarks: string }) => {
      const existing = actualMap.get(`${machine.id}|${date}`);
      if (existing) {
        const { error } = await supabase
          .from('pm_actual')
          .update({ remarks: remarks || null })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pm_actual').insert({
          machine_id: machine.id,
          actual_date: date,
          remarks: remarks || null,
          recorded_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm_actual', monthStart, monthEnd] });
      setRemarksDialog(null);
      setRemarksText('');
      toast.success('PM actual saved');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save actual'),
  });

  const [confirmRemove, setConfirmRemove] = useState(false);

  const removeActualMutation = useMutation({
    mutationFn: async (actualId: string) => {
      const { error } = await supabase.from('pm_actual').delete().eq('id', actualId);
      if (error) throw error;
    },
    onMutate: async (actualId: string) => {
      await qc.cancelQueries({ queryKey: ['pm_actual', monthStart, monthEnd] });
      const prev = qc.getQueryData<PmActual[]>(['pm_actual', monthStart, monthEnd]);
      qc.setQueryData<PmActual[]>(['pm_actual', monthStart, monthEnd], (old) =>
        (old ?? []).filter((a) => a.id !== actualId),
      );
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pm_actual', monthStart, monthEnd] });
      setRemarksDialog(null);
      setRemarksText('');
      setConfirmRemove(false);
      toast.success('PM actual removed');
    },
    onError: (e: any, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['pm_actual', monthStart, monthEnd], ctx.prev);
      toast.error(e?.message ?? 'Failed to remove actual');
    },
  });

  // ---------- Helpers ----------
  function shiftMonth(delta: number) {
    setRefDate(new Date(refDate.getFullYear(), refDate.getMonth() + delta, 1));
  }

  function setAllCollapsed(value: boolean) {
    const next: Record<string, boolean> = {};
    for (const k of Object.keys(grouped)) next[k] = value;
    setCollapsed(next);
  }

  function openRemarks(machine: PmMachine, date: string) {
    const existing = actualMap.get(`${machine.id}|${date}`) ?? null;
    setRemarksDialog({ machine, date, existingActual: existing });
    setRemarksText(existing?.remarks ?? '');
  }

  function handleCellClick(machine: PmMachine, date: string) {
    const isPast = daysBetween(date, today) > 0;
    const plan = planMap.get(`${machine.id}|${date}`);
    const actual = actualMap.get(`${machine.id}|${date}`);

    if (mode === 'plan') {
      if (!canEditPlan) return;
      if (isPast) {
        toast.error('Plan locked for past dates');
        return;
      }
      togglePlanMutation.mutate({ machine, date });
      return;
    }

    // mode === 'actual'
    if (!canEditActual) return;
    if (!plan && !actual && !hasAnyRole('super_admin')) {
      toast.error('No plan exists for this date');
      return;
    }
    if (daysBetween(today, date) > 0) {
      toast.error('Cannot mark actual on a future date');
      return;
    }
    openRemarks(machine, date);
  }

  // ---------- Render ----------
  const monthLabel = refDate.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  const isLoading = machinesQuery.isLoading || plansQuery.isLoading || actualsQuery.isLoading;

  return (
    <div className="container mx-auto py-6 px-4 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">PM Schedule</h1>
          <p className="text-sm text-muted-foreground">Preventive Maintenance Planning &amp; Tracking</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Month nav */}
          <div className="inline-flex items-center rounded-md border bg-card">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shiftMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-2 text-sm font-medium min-w-[88px] text-center">{monthLabel}</div>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => shiftMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Mode toggle */}
          <div className="inline-flex rounded-md border bg-card overflow-hidden">
            {(['plan', 'actual'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-4 h-9 text-sm font-medium capitalize transition-colors',
                  mode === m ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Line filter */}
          <div className="inline-flex rounded-md border bg-card overflow-hidden">
            {(['All', 'SFM', 'RFM'] as LineFilter[]).map((l) => (
              <button
                key={l}
                onClick={() => setLineFilter(l)}
                className={cn(
                  'px-3 h-9 text-sm font-medium transition-colors',
                  lineFilter === l ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Criticality */}
          <Select value={critFilter} onValueChange={(v) => setCritFilter(v as CriticalityFilter)}>
            <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All criticality</SelectItem>
              <SelectItem value="CriticalOnly">Critical only</SelectItem>
              <SelectItem value="NonCriticalOnly">Non-critical only</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              <Settings className="h-4 w-4 mr-1.5" /> Manage
            </Button>
          )}
        </div>
      </div>

      {/* Collapse / Expand */}
      <div className="flex items-center gap-2 mb-2">
        <Button variant="ghost" size="sm" onClick={() => setAllCollapsed(false)}>Expand all</Button>
        <Button variant="ghost" size="sm" onClick={() => setAllCollapsed(true)}>Collapse all</Button>
        <span className="text-xs text-muted-foreground ml-2">
          {visibleMachines.length} machines · {monthDays.length} days
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mb-3 text-xs text-muted-foreground">
        <LegendDot className="border-2 border-primary" label="Planned" />
        <LegendDot className="bg-success" label="Done on time" />
        <LegendDot className="bg-warning" label="Done delayed" />
        <LegendDot className="bg-destructive" label="Overdue" />
      </div>

      {/* Grid */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 bg-muted/60 text-left text-xs font-semibold px-3 py-2 border-b border-r min-w-[180px]"
                  style={{ position: 'sticky', left: 0 }}
                >
                  Machine
                </th>
                {monthDays.map((d) => {
                  const iso = toIsoDate(d);
                  const isToday = iso === today;
                  const isPast = daysBetween(iso, today) > 0;
                  return (
                    <th
                      key={iso}
                      className={cn(
                        'text-[11px] font-medium border-b border-r w-8 min-w-8 px-0 py-1.5 text-center',
                        isToday && 'bg-primary/15 text-primary',
                        isPast && !isToday && 'text-muted-foreground/70',
                      )}
                      title={iso}
                    >
                      {d.getDate()}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={monthDays.length + 1} className="p-6 text-center text-sm text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && Object.keys(grouped).length === 0 && (
                <tr><td colSpan={monthDays.length + 1} className="p-6 text-center text-sm text-muted-foreground">No machines match the current filters.</td></tr>
              )}
              {Object.entries(grouped).map(([groupKey, list]) => {
                const isCollapsed = collapsed[groupKey] ?? false;
                return (
                  <FragmentGroup
                    key={groupKey}
                    groupKey={groupKey}
                    machines={list}
                    isCollapsed={isCollapsed}
                    onToggle={() => setCollapsed({ ...collapsed, [groupKey]: !isCollapsed })}
                    days={monthDays}
                    today={today}
                    mode={mode}
                    planMap={planByMachineDate}
                    actualMap={actualMap}
                    onCellClick={handleCellClick}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Remarks dialog */}
      <Dialog
        open={!!remarksDialog}
        onOpenChange={(o) => {
          if (!o) {
            setRemarksDialog(null);
            setConfirmRemove(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {remarksDialog?.existingActual ? 'Edit PM Actual' : 'Mark PM Done'}
            </DialogTitle>
          </DialogHeader>
          {remarksDialog && (
            <div className="space-y-3">
              <div className="text-sm">
                <div><span className="text-muted-foreground">Machine:</span> <strong>{remarksDialog.machine.name}</strong></div>
                <div><span className="text-muted-foreground">Date:</span> <strong>{remarksDialog.date}</strong></div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Remarks (optional)</label>
                <Textarea
                  value={remarksText}
                  onChange={(e) => setRemarksText(e.target.value.slice(0, 500))}
                  placeholder="Notes about this PM"
                  rows={4}
                />
                <div className="text-[10px] text-muted-foreground text-right">{remarksText.length}/500</div>
              </div>
              {confirmRemove && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground">
                  Are you sure you want to remove this PM actual entry? This cannot be undone.
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            {remarksDialog?.existingActual && !confirmRemove && (
              <Button
                variant="destructive"
                onClick={() => setConfirmRemove(true)}
                className="sm:mr-auto"
                disabled={removeActualMutation.isPending}
              >
                Remove Actual Entry
              </Button>
            )}
            {confirmRemove ? (
              <>
                <Button variant="outline" onClick={() => setConfirmRemove(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={removeActualMutation.isPending}
                  onClick={() => {
                    if (remarksDialog?.existingActual) {
                      removeActualMutation.mutate(remarksDialog.existingActual.id);
                    }
                  }}
                >
                  Yes, Remove
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setRemarksDialog(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!remarksDialog) return;
                    upsertActualMutation.mutate({
                      machine: remarksDialog.machine,
                      date: remarksDialog.date,
                      remarks: remarksText.trim(),
                    });
                  }}
                  disabled={upsertActualMutation.isPending}
                >
                  {remarksDialog?.existingActual ? 'Update Remarks' : 'Save'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Machines panel */}
      {isAdmin && (
        <ManageMachinesSheet
          open={manageOpen}
          onClose={() => setManageOpen(false)}
          machines={machines}
          onSaved={() => qc.invalidateQueries({ queryKey: ['pm_machines'] })}
        />
      )}
    </div>
  );
}

// ---------- Subcomponents ----------

function LegendDot({ className, label }: { className?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('inline-block h-3 w-3 rounded-full', className)} />
      {label}
    </span>
  );
}

interface FragmentGroupProps {
  groupKey: string;
  machines: PmMachine[];
  isCollapsed: boolean;
  onToggle: () => void;
  days: Date[];
  today: string;
  mode: Mode;
  planMap: Map<string, PmPlan>;
  actualMap: Map<string, PmActual>;
  onCellClick: (m: PmMachine, date: string) => void;
}

function FragmentGroup({
  groupKey, machines, isCollapsed, onToggle, days, today, mode, planMap, actualMap, onCellClick,
}: FragmentGroupProps) {
  return (
    <>
      <tr className="bg-muted/40">
        <td
          colSpan={days.length + 1}
          className="sticky left-0 z-10 px-3 py-1.5 text-xs font-semibold text-foreground border-b cursor-pointer select-none"
          onClick={onToggle}
        >
          <span className="inline-flex items-center gap-1">
            {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {groupKey} <span className="text-muted-foreground font-normal">({machines.length})</span>
          </span>
        </td>
      </tr>
      {!isCollapsed && machines.map((m) => {
        // overdue if any plan for this machine in shown days is overdue without actual
        const isOverdueRow = days.some((d) => {
          const iso = toIsoDate(d);
          const p = planMap.get(`${m.id}|${iso}`);
          if (!p) return false;
          const a = actualMap.get(`${m.id}|${iso}`);
          if (a) return false;
          return daysBetween(iso, today) > 2;
        });
        return (
          <tr
            key={m.id}
            className={cn(
              !m.is_critical && 'bg-muted/20',
              isOverdueRow && 'bg-destructive/5',
            )}
          >
            <td
              className="sticky left-0 z-10 bg-card border-b border-r px-3 py-1.5 text-xs font-medium min-w-[180px]"
              style={{ position: 'sticky', left: 0 }}
            >
              <div className={cn('flex items-center gap-1.5', !m.is_critical && 'italic text-muted-foreground')}>
                <span className="truncate">{m.name}</span>
                {!m.is_critical && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 leading-tight">non-critical</Badge>
                )}
              </div>
            </td>
            {days.map((d) => {
              const iso = toIsoDate(d);
              const plan = planMap.get(`${m.id}|${iso}`) ?? null;
              const actual = actualMap.get(`${m.id}|${iso}`) ?? null;
              const state = getCellState(plan, actual, iso, today);
              return (
                <Cell
                  key={iso}
                  state={state}
                  date={iso}
                  today={today}
                  mode={mode}
                  plan={plan}
                  actual={actual}
                  onClick={() => onCellClick(m, iso)}
                />
              );
            })}
          </tr>
        );
      })}
    </>
  );
}

function Cell({
  state, date, today, mode, plan, actual, onClick,
}: {
  state: CellState; date: string; today: string; mode: Mode;
  plan: PmPlan | null; actual: PmActual | null; onClick: () => void;
}) {
  const isPast = daysBetween(date, today) > 0;
  const isFuture = daysBetween(today, date) > 0;
  const planDisabled = mode === 'plan' && isPast;
  const actualDisabled = mode === 'actual' && isFuture;
  const disabled = planDisabled || actualDisabled;

  let inner: React.ReactNode = null;
  let tooltip: string | null = null;

  switch (state) {
    case 'empty':
      inner = null;
      break;
    case 'planned-future':
    case 'planned-past':
      inner = <span className="block h-3 w-3 rounded-full border-2 border-primary" />;
      tooltip = `Planned: ${plan?.planned_date}`;
      break;
    case 'overdue':
      inner = <span className="block h-3 w-3 rounded-full border-2 border-destructive" />;
      tooltip = `Overdue. Planned: ${plan?.planned_date}. ${daysBetween(plan!.planned_date, today)} days overdue.`;
      break;
    case 'done-on-time':
      inner = <span className="block h-3 w-3 rounded-full bg-success" />;
      tooltip = `PM Done: ${actual?.actual_date}${plan ? `. Planned: ${plan.planned_date}` : ''}${actual?.remarks ? `\n${actual.remarks}` : ''}`;
      break;
    case 'done-delayed-minor':
    case 'done-delayed-major':
      inner = <span className={cn('block h-3 w-3 rounded-full', state === 'done-delayed-minor' ? 'bg-warning' : 'bg-destructive')} />;
      tooltip = plan
        ? `PM Done: ${actual?.actual_date}. Planned: ${plan.planned_date}. Delayed by ${daysBetween(plan.planned_date, actual!.actual_date)} days.${actual?.remarks ? `\n${actual.remarks}` : ''}`
        : `PM Done: ${actual?.actual_date}`;
      break;
  }

  const cellNode = (
    <td className="border-b border-r p-0 text-center align-middle">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'w-8 h-8 inline-flex items-center justify-center transition-colors',
          !disabled && 'hover:bg-muted/50 cursor-pointer',
          disabled && 'cursor-not-allowed opacity-70',
          state === 'empty' && 'bg-transparent',
        )}
      >
        {inner ?? (planDisabled ? <Lock className="h-2.5 w-2.5 text-muted-foreground/40" /> : <span className="block h-1 w-1" />)}
      </button>
    </td>
  );

  if (!tooltip) return cellNode;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{cellNode}</TooltipTrigger>
        <TooltipContent>
          <pre className="text-xs whitespace-pre-wrap font-sans">{tooltip}</pre>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------- Manage Machines (admin) ----------

function ManageMachinesSheet({
  open, onClose, machines, onSaved,
}: { open: boolean; onClose: () => void; machines: PmMachine[]; onSaved: () => void }) {
  const [edits, setEdits] = useState<Record<string, Partial<PmMachine>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setEdits({});
  }, [open]);

  function patch(id: string, p: Partial<PmMachine>) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...p } }));
  }

  async function save(m: PmMachine) {
    const e = edits[m.id];
    if (!e) return;
    setSaving(m.id);
    const { error } = await supabase
      .from('pm_machines')
      .update({
        name: e.name ?? m.name,
        line: (e.line ?? m.line),
        group_name: e.group_name ?? m.group_name,
        is_critical: e.is_critical ?? m.is_critical,
        is_active: e.is_active ?? m.is_active,
        display_order: e.display_order ?? m.display_order,
        updated_at: new Date().toISOString(),
      })
      .eq('id', m.id);
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Machine updated');
    setEdits((curr) => {
      const next = { ...curr };
      delete next[m.id];
      return next;
    });
    onSaved();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="sm:max-w-[720px] w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Manage Machines</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {/* Column headers */}
          <div className="sticky top-0 z-10 bg-background border-b pb-2 grid grid-cols-12 gap-2 px-3 text-xs text-muted-foreground font-medium">
            <div className="col-span-3">Machine Name</div>
            <div className="col-span-2">Line</div>
            <div className="col-span-2">Group</div>
            <div className="col-span-1 text-center">Critical</div>
            <div className="col-span-1 text-center">Active</div>
            <div className="col-span-1 text-center">Order</div>
            <div className="col-span-2" />
          </div>
          {machines.map((m) => {
            const e = edits[m.id] ?? {};
            const dirty = Object.keys(e).length > 0;
            return (
              <Card key={m.id} className="p-3 grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-3 h-8 text-xs" value={(e.name ?? m.name) as string} onChange={(ev) => patch(m.id, { name: ev.target.value })} />
                <Select value={(e.line ?? m.line) as string} onValueChange={(v) => patch(m.id, { line: v as 'SFM' | 'RFM' })}>
                  <SelectTrigger className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SFM">SFM</SelectItem>
                    <SelectItem value="RFM">RFM</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="col-span-2 h-8 text-xs" value={(e.group_name ?? m.group_name) as string} onChange={(ev) => patch(m.id, { group_name: ev.target.value })} />
                <div className="col-span-1 flex items-center justify-center">
                  <Switch checked={(e.is_critical ?? m.is_critical) as boolean} onCheckedChange={(v) => patch(m.id, { is_critical: v })} />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <Switch checked={(e.is_active ?? m.is_active) as boolean} onCheckedChange={(v) => patch(m.id, { is_active: v })} />
                </div>
                <Input
                  type="number"
                  className="col-span-1 h-8 text-xs"
                  value={(e.display_order ?? m.display_order) as number}
                  onChange={(ev) => patch(m.id, { display_order: Number(ev.target.value) })}
                />
                <Button size="sm" disabled={!dirty || saving === m.id} onClick={() => save(m)} className="col-span-2 h-8">
                  {saving === m.id ? 'Saving…' : 'Save'}
                </Button>
              </Card>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
