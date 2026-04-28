import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { format, differenceInSeconds, parseISO } from 'date-fns';
import { getMeetingKpiReportingDate } from '@/lib/utils';
import { getMtdDateRange, calculateMtd, computeRagFromValue } from '@/lib/mtdUtils';
import { buildSnapshotCollapseSummary, getMeetingSnapshotCollapseKey, setAllCollapseStates } from '@/lib/dashboardUtils';
import { logAudit } from '@/lib/auditLog';
import { formatIndianNumber } from '@/lib/formatNumber';
import { fetchAllKpiEntries } from '@/lib/kpiEntriesApi';
import { buildTaskPayload } from '@/lib/taskPayload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Play, Square, Clock, AlertTriangle, Plus, Trash2, ArrowUp, ArrowDown, ChevronDown, ChevronUp, ChevronRight, Info, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';
import { PmScheduleGrid } from '@/components/pm/PmScheduleGrid';

type MeetingStatus = Database['public']['Enums']['meeting_status'];
type RagStatus = Database['public']['Enums']['rag_status'];
type AttendanceStatus = Database['public']['Enums']['attendance_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary',
  in_progress: 'bg-rag-amber/20 text-warning',
  completed: 'bg-rag-green/20 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

const RAG_COLORS: Record<RagStatus, string> = {
  green: 'bg-rag-green text-white',
  amber: 'bg-rag-amber text-white',
  red: 'bg-rag-red text-white',
};

export default function MeetingWorkspace() {
  const { id } = useParams<{ id: string }>();
  const { user, hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState('kpi');
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [redKpiCount, setRedKpiCount] = useState(0);

  const { data: meeting, isLoading } = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('meetings').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('meetings').update({
        status: 'in_progress' as MeetingStatus,
        actual_start: new Date().toISOString(),
      }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      toast({ title: 'Meeting started' });
      logAudit('meetings', id!, 'UPDATE', { status: 'scheduled' }, { status: 'in_progress', actual_start: new Date().toISOString() });
    },
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('meetings').update({
        status: 'completed' as MeetingStatus,
        actual_end: new Date().toISOString(),
      }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      toast({ title: 'Meeting completed' });
      setShowEndConfirm(false);
      logAudit('meetings', id!, 'UPDATE', { status: 'in_progress' }, { status: 'completed', actual_end: new Date().toISOString() });
    },
  });

  const handleEnd = async () => {
    const kpiDate = getMeetingKpiReportingDate(meeting!.scheduled_date);
    const { data: redEntries } = await supabase
      .from('kpi_entries')
      .select('id, kpi_id')
      .eq('reporting_date', kpiDate)
      .eq('computed_status', 'red');

    if (redEntries?.length) {
      const { data: linkedTasks } = await supabase
        .from('tasks')
        .select('origin_kpi_entry_id')
        .in('origin_kpi_entry_id', redEntries.map((e) => e.id));
      const linkedIds = new Set(linkedTasks?.map((t) => t.origin_kpi_entry_id));
      const unlinked = redEntries.filter((e) => !linkedIds.has(e.id));
      if (unlinked.length > 0) {
        setRedKpiCount(unlinked.length);
        setShowEndConfirm(true);
        return;
      }
    }
    endMutation.mutate();
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!meeting) return <p className="text-center py-12 text-muted-foreground">Meeting not found</p>;

  const isCompleted = meeting.status === 'completed' || meeting.status === 'cancelled';
  const isScheduled = meeting.status === 'scheduled';
  const isInProgress = meeting.status === 'in_progress';
  const canEditAfterComplete = hasAnyRole('super_admin', 'factory_manager');
  const readOnly = isCompleted && !canEditAfterComplete;
  // Tabs that require meeting to be started
  const tabsLocked = isScheduled; // Notes, Decisions, Tasks locked when scheduled
  const tabsEditable = isInProgress || (isCompleted && canEditAfterComplete);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-bold truncate">{meeting.title}</h1>
            <p className="text-xs text-muted-foreground">
              {format(new Date(meeting.scheduled_date), 'dd MMM yyyy')} · {meeting.scheduled_start_time?.slice(0, 5)} – {meeting.scheduled_end_time?.slice(0, 5)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge className={cn('text-[10px]', STATUS_COLORS[meeting.status])}>{meeting.status.replace('_', ' ')}</Badge>
            {meeting.status === 'scheduled' && (
              <Button size="sm" className="bg-rag-green hover:bg-rag-green/90 text-white h-9 gap-1" onClick={() => startMutation.mutate()} disabled={startMutation.isPending}>
                <Play className="h-3.5 w-3.5" /> Start
              </Button>
            )}
            {meeting.status === 'in_progress' && (
              <>
                <ElapsedTimer start={meeting.actual_start!} />
                <Button size="sm" variant="destructive" className="h-9 gap-1" onClick={handleEnd} disabled={endMutation.isPending}>
                  <Square className="h-3.5 w-3.5" /> End
                </Button>
              </>
            )}
            {isCompleted && meeting.actual_start && meeting.actual_end && (
              <span className="text-xs text-muted-foreground">
                Duration: {Math.round(differenceInSeconds(new Date(meeting.actual_end), new Date(meeting.actual_start)) / 60)}m
              </span>
            )}
          </div>
        </div>
        {/* FIX 7: Post-completion editing banner */}
        {isCompleted && canEditAfterComplete && (
          <div className="flex items-center gap-1.5 text-xs text-rag-amber bg-rag-amber/10 px-2 py-1 rounded">
            <Info className="h-3.5 w-3.5 shrink-0" /> Meeting completed — editing as privileged user
          </div>
        )}
      </div>

      {/* FIX 1: Sticky tab bar with proper horizontal scroll */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="sticky top-0 z-[5] bg-background border-b">
            <div className="overflow-x-auto scrollbar-none">
              <TabsList className="bg-transparent h-10 w-max min-w-full px-4 gap-0 rounded-none justify-start">
                <TabsTrigger value="kpi" className="text-xs sm:text-sm whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3">KPI Snapshot</TabsTrigger>
                <TabsTrigger value="attendance" className="text-xs sm:text-sm whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3">Attendance</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs sm:text-sm whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3">Notes &amp; Discussion</TabsTrigger>
                <TabsTrigger value="decisions" className="text-xs sm:text-sm whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3">Decisions</TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs sm:text-sm whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-3">Tasks</TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="p-4 flex-1">
            <TabsContent value="kpi" className="mt-0"><KpiSnapshotTab meeting={meeting} /></TabsContent>
            <TabsContent value="attendance" className="mt-0"><AttendanceTab meeting={meeting} readOnly={readOnly} /></TabsContent>
            <TabsContent value="notes" className="mt-0">
              {tabsLocked ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Start the meeting to enable notes</p>
                </div>
              ) : <NotesTab meeting={meeting} readOnly={readOnly} />}
            </TabsContent>
            <TabsContent value="decisions" className="mt-0">
              {tabsLocked ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Start the meeting to record decisions</p>
                </div>
              ) : <DecisionsTab meeting={meeting} readOnly={readOnly} />}
            </TabsContent>
            <TabsContent value="tasks" className="mt-0">
              {tabsLocked ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Clock className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">Start the meeting to create tasks</p>
                </div>
              ) : <MeetingTasksTab meeting={meeting} />}
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* End Meeting Confirmation */}
      <Dialog open={showEndConfirm} onOpenChange={setShowEndConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>End Meeting?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{redKpiCount} Red KPI{redKpiCount > 1 ? 's' : ''} ha{redKpiCount > 1 ? 've' : 's'} no assigned action. End meeting anyway?</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEndConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => endMutation.mutate()} disabled={endMutation.isPending}>End Meeting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ElapsedTimer({ start }: { start: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(differenceInSeconds(new Date(), new Date(start)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [start]);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return (
    <span className="text-xs font-mono tabular-nums bg-muted px-2 py-1 rounded">
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  );
}

// ─── KPI SNAPSHOT TAB ─────────────────────────────
function KpiSnapshotTab({ meeting }: { meeting: any }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskKpiEntry, setTaskKpiEntry] = useState<any>(null);
  const [taskKpi, setTaskKpi] = useState<any>(null);
  const [ootFilter, setOotFilter] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('fulcrum-meeting-oot-filter') === 'true';
    return false;
  });
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const kpiDate = getMeetingKpiReportingDate(meeting.scheduled_date);

  const { data: departments } = useQuery({
    queryKey: ['all-departments'],
    queryFn: async () => {
      const { data } = await supabase.from('department').select('id, name, code').eq('is_active', true).order('display_order');
      return data || [];
    },
  });

  const { data: kpis } = useQuery({
    queryKey: ['all-kpis-snapshot'],
    queryFn: async () => {
      const { data } = await supabase.from('kpi_master').select('*').eq('is_active', true).in('kpi_type', ['numeric', 'descriptive']).order('display_order');
      return data || [];
    },
  });

  const { data: pmKpis } = useQuery({
    queryKey: ['pm-kpis-snapshot'],
    queryFn: async () => {
      const { data } = await supabase
        .from('kpi_master')
        .select('id, name, department_id')
        .eq('is_active', true)
        .eq('kpi_type', 'project_tracker')
        .ilike('name', '%PM Schedule%')
        .order('display_order');
      return data || [];
    },
  });


  const { data: entries } = useQuery({
    queryKey: ['kpi-entries-snapshot', kpiDate],
    queryFn: async () => {
      const { data } = await supabase.from('kpi_entries').select('*').eq('reporting_date', kpiDate);
      return data || [];
    },
  });

  const mtdRange = useMemo(() => getMtdDateRange(kpiDate), [kpiDate]);

  const { data: mtdEntries } = useQuery({
    queryKey: ['kpi-mtd-snapshot', mtdRange.from, mtdRange.to],
    queryFn: async () => {
      return fetchAllKpiEntries(mtdRange.from, mtdRange.to, 'kpi_id, actual_value, reporting_date');
    },
  });

  const mtdByKpi = useMemo(() => {
    const m: Record<string, { actual_value: number | null; reporting_date: string }[]> = {};
    mtdEntries?.forEach((e) => {
      if (!m[e.kpi_id]) m[e.kpi_id] = [];
      m[e.kpi_id].push({ actual_value: e.actual_value, reporting_date: e.reporting_date });
    });
    return m;
  }, [mtdEntries]);

  const { data: tasks } = useQuery({
    queryKey: ['kpi-tasks-snapshot', kpiDate],
    queryFn: async () => {
      const entryIds = entries?.map((e) => e.id) || [];
      if (!entryIds.length) return [];
      const { data } = await supabase.from('tasks').select('origin_kpi_entry_id').in('origin_kpi_entry_id', entryIds);
      return data || [];
    },
    enabled: !!entries,
  });

  const linkedEntryIds = new Set(tasks?.map((t) => t.origin_kpi_entry_id));

  // Initialize collapse state from localStorage once departments load
  useEffect(() => {
    if (!departments?.length) return;
    const initial: Record<string, boolean> = {};
    departments.forEach((d) => {
      const stored = localStorage.getItem(getMeetingSnapshotCollapseKey(d.code));
      initial[d.code] = stored === 'true';
    });
    setCollapsed(initial);
  }, [departments]);

  const toggleDept = (code: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [code]: !prev[code] };
      localStorage.setItem(getMeetingSnapshotCollapseKey(code), String(next[code]));
      return next;
    });
  };

  const collapseAll = () => {
    if (!departments) return;
    const codes = departments.map((d) => d.code);
    const result = setAllCollapseStates(codes, true, getMeetingSnapshotCollapseKey);
    setCollapsed(result);
  };

  const expandAll = () => {
    if (!departments) return;
    const codes = departments.map((d) => d.code);
    const result = setAllCollapseStates(codes, false, getMeetingSnapshotCollapseKey);
    setCollapsed(result);
  };

  const openCreateTask = (entry: any, kpi: any) => {
    setTaskKpiEntry(entry);
    setTaskKpi(kpi);
    setShowTaskModal(true);
  };

  if (!departments || !kpis) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  const toggleOot = (val: boolean) => {
    setOotFilter(val);
    localStorage.setItem('fulcrum-meeting-oot-filter', String(val));
  };

  const hasAnyOot = entries?.some((e) => e.computed_status === 'red' || e.computed_status === 'amber') ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            KPI Performance — {format(new Date(kpiDate + 'T00:00:00'), 'dd MMM yyyy')}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Showing previous day's data · T4 reviews cover the day before the meeting date
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
          <div className="flex items-center gap-1">
            <button onClick={collapseAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Collapse All</button>
            <span className="text-xs text-muted-foreground">·</span>
            <button onClick={expandAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Expand All</button>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="oot-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">Out-of-target only</label>
            <Switch id="oot-toggle" checked={ootFilter} onCheckedChange={toggleOot} />
          </div>
        </div>
      </div>
      {ootFilter && !hasAnyOot ? (
        <div className="flex items-center justify-center gap-2 py-8">
          <CheckCircle2 className="h-5 w-5" style={{ color: 'var(--rag-green-border)' }} />
          <span className="text-sm font-medium" style={{ color: 'var(--rag-green-border)' }}>All KPIs are on target ✓</span>
        </div>
      ) : departments.map((dept) => {
        const deptKpis = kpis.filter((k) => k.department_id === dept.id);
        const filteredKpis = ootFilter
          ? deptKpis.filter((kpi) => {
              const entry = entries?.find((e) => e.kpi_id === kpi.id);
              return entry?.computed_status === 'red' || entry?.computed_status === 'amber';
            })
          : deptKpis;
        if (!filteredKpis.length) return null;

        const isCollapsed = collapsed[dept.code] ?? false;
        const statuses = filteredKpis.map((kpi) => {
          const entry = entries?.find((e) => e.kpi_id === kpi.id);
          return entry?.computed_status ?? null;
        });
        const summary = buildSnapshotCollapseSummary(statuses);

        return (
          <Card key={dept.id} className="themed-card overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}>
            <div
              className="pl-3 pr-4 py-3 flex items-center justify-between cursor-pointer select-none hover:opacity-80 transition-opacity"
              style={{ borderLeft: '4px solid var(--color-primary)' }}
              onClick={() => toggleDept(dept.code)}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                )}
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{dept.name}</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {isCollapsed && (
                  <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    {summary.total} KPIs
                    {summary.red > 0 && <span style={{ color: 'var(--rag-red-border)' }}>🔴 {summary.red}</span>}
                    {summary.amber > 0 && <span style={{ color: 'var(--rag-amber-border)' }}>🟡 {summary.amber}</span>}
                    {summary.green > 0 && <span style={{ color: 'var(--rag-green-border)' }}>🟢 {summary.green}</span>}
                    {summary.red === 0 && summary.amber === 0 && summary.green === 0 && summary.total > 0 && (
                      <span style={{ color: 'var(--text-muted)' }}>— {summary.total} no data</span>
                    )}
                  </span>
                )}
              </div>
            </div>
            {!isCollapsed && (
              <div style={{ borderTop: '1px solid var(--border-card)' }} className="space-y-2 p-3">
                {filteredKpis.map((kpi) => {
                  const entry = entries?.find((e) => e.kpi_id === kpi.id);
                  const isRed = entry?.computed_status === 'red';
                  const hasTask = entry ? linkedEntryIds.has(entry.id) : false;
                  const isNumeric = kpi.kpi_type === 'numeric';
                  const mtdVal = isNumeric ? calculateMtd(mtdByKpi[kpi.id] || [], kpi.mtd_aggregation ?? 'sum', new Date(kpiDate + 'T00:00:00')) : null;
                  const mtdRag = mtdVal !== null ? computeRagFromValue(mtdVal, kpi) : null;
                  const targetDisplay = isNumeric ? (kpi.target_value != null ? `${formatIndianNumber(kpi.target_value)}${kpi.unit ? ` ${kpi.unit}` : ''}` : '—') : null;
                  const mtdDisplay = formatIndianNumber(mtdVal);
                  return (
                    <Card key={kpi.id} className={cn(isRed && !hasTask && 'border-destructive/50')}>
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{kpi.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {isNumeric && <span className="text-xs text-muted-foreground">Target: {targetDisplay}</span>}
                            {entry ? (
                              <>
                                <span className="text-xs">Actual: {entry.actual_value != null ? formatIndianNumber(entry.actual_value) : (entry.text_value ?? '—')}</span>
                                {isNumeric && (
                                  <span className="text-xs" style={{ color: mtdRag ? `var(--rag-${mtdRag}-border)` : undefined }}>
                                    MTD: {mtdDisplay}
                                  </span>
                                )}
                                {entry.computed_status && <Badge className={cn('text-[10px]', RAG_COLORS[entry.computed_status as RagStatus])}>{entry.computed_status.toUpperCase()}</Badge>}
                              </>
                            ) : (
                              <>
                                <span className="text-xs text-muted-foreground italic">Not Submitted</span>
                                {isNumeric && mtdVal !== null && (
                                  <span className="text-xs" style={{ color: mtdRag ? `var(--rag-${mtdRag}-border)` : undefined }}>
                                    MTD: {mtdDisplay}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isRed && !hasTask && (
                            <>
                              <Badge variant="destructive" className="text-[10px]">⚠ No Action</Badge>
                              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openCreateTask(entry, kpi)}>
                                <Plus className="h-3 w-3 mr-1" />Task
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            {!isCollapsed && !ootFilter && (pmKpis ?? []).filter((p) => p.department_id === dept.id).map((pk) => {
              const n = pk.name.toLowerCase();
              const pmLine: 'SFM' | 'RFM' | null = n.includes('sfm') ? 'SFM' : n.includes('rfm') ? 'RFM' : null;
              if (!pmLine) return null;
              return (
                <div key={pk.id} className="px-3 pb-3" style={{ borderTop: '1px solid var(--border-card)' }}>
                  <p className="text-xs font-medium py-2" style={{ color: 'var(--text-secondary)' }}>{pk.name}</p>
                  <PmScheduleGrid month={new Date(meeting.scheduled_date + 'T00:00:00')} line={pmLine} height="compact" showLink={false} />
                </div>
              );
            })}
          </Card>
        );
      })}

      {showTaskModal && taskKpiEntry && taskKpi && (
        <CreateTaskFromKpiModal
          open={showTaskModal}
          onOpenChange={setShowTaskModal}
          meetingId={meeting.id}
          kpiEntry={taskKpiEntry}
          kpi={taskKpi}
        />
      )}
    </div>
  );
}

function CreateTaskFromKpiModal({ open, onOpenChange, meetingId, kpiEntry, kpi }: {
  open: boolean; onOpenChange: (v: boolean) => void; meetingId: string; kpiEntry: any; kpi: any;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [title, setTitle] = useState(`Action for Red KPI: ${kpi.name}`);
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('high');
  const [dueDate, setDueDate] = useState<Date | undefined>(new Date());
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: deptUsers } = useQuery({
    queryKey: ['dept-users', kpi.department_id],
    queryFn: async () => {
      const { data: uds } = await supabase.from('user_departments').select('user_id').eq('department_id', kpi.department_id);
      if (!uds?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', uds.map((u) => u.user_id)).eq('is_active', true);
      return data || [];
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const dueDateStr = format(dueDate!, 'yyyy-MM-dd');
      if (dueDateStr < today) throw new Error('Due date cannot be in the past');
      const { data, error } = await supabase.from('tasks').insert({
        title,
        description: description || null,
        department_id: kpi.department_id,
        owner_id: ownerId,
        assigned_by: user!.id,
        priority,
        due_date: dueDateStr,
        origin_type: 'kpi_red',
        origin_meeting_id: meetingId,
        origin_kpi_entry_id: kpiEntry.id,
        created_by: user!.id,
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Task created' });
      queryClient.invalidateQueries({ queryKey: ['kpi-tasks-snapshot'] });
      queryClient.invalidateQueries({ queryKey: ['meeting-tasks'] });
      onOpenChange(false);
      logAudit('tasks', data.id, 'INSERT', null, { title, origin_type: 'kpi_red', origin_meeting_id: meetingId });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(isMobile && 'h-full max-h-full w-full max-w-full rounded-none border-0', 'sm:max-w-lg')}>
        <DialogHeader><DialogTitle>Create Task from Red KPI</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Origin: {kpi.name}</p>
        <div className="space-y-3">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 mt-1" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1" /></div>
          <div>
            <Label>Owner *</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select owner" /></SelectTrigger>
              <SelectContent>{deptUsers?.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Due Date *</Label>
              <Input type="date" min={today} value={dueDate ? format(dueDate, 'yyyy-MM-dd') : ''} onChange={(e) => setDueDate(new Date(e.target.value))} className="h-11 mt-1" />
            </div>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!title || !ownerId || !dueDate || createMutation.isPending} className="w-full h-12">
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── ATTENDANCE TAB ─────────────────────────────
function AttendanceTab({ meeting, readOnly }: { meeting: any; readOnly: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestDesignation, setGuestDesignation] = useState('');
  const [addUserId, setAddUserId] = useState('');

  const { data: invitees, isLoading } = useQuery({
    queryKey: ['meeting-invitees', meeting.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('meeting_invitees')
        .select('*, user:profiles!meeting_invitees_user_id_fkey(full_name), dept:department!meeting_invitees_department_id_fkey(name)')
        .eq('meeting_id', meeting.id);
      return data || [];
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ['meeting-attendance', meeting.id],
    queryFn: async () => {
      const { data } = await supabase.from('meeting_attendance').select('*').eq('meeting_id', meeting.id);
      return data || [];
    },
  });

  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-invite'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email').eq('is_active', true).order('full_name');
      return data || [];
    },
  });

  const addInviteeMutation = useMutation({
    mutationFn: async () => {
      const payload: any = { meeting_id: meeting.id };
      if (addUserId) {
        payload.user_id = addUserId;
      } else {
        payload.guest_name = guestName;
        payload.guest_designation = guestDesignation || null;
      }
      const { error } = await supabase.from('meeting_invitees').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-invitees', meeting.id] });
      setShowAddPerson(false);
      setAddUserId('');
      setGuestName('');
      setGuestDesignation('');
      toast({ title: 'Person added' });
    },
  });

  const markAttendanceMutation = useMutation({
    mutationFn: async ({ inviteeId, status, remarks }: { inviteeId: string; status: AttendanceStatus; remarks?: string }) => {
      const existing = attendance?.find((a) => a.invitee_id === inviteeId);
      let autoRemarks = remarks || '';
      if (status === 'present' && meeting.actual_start) {
        const startTime = new Date(meeting.actual_start);
        const now = new Date();
        if (differenceInSeconds(now, startTime) > 300 && !autoRemarks.includes('Late')) {
          autoRemarks = autoRemarks ? `${autoRemarks} (Late)` : '(Late)';
        }
      }
      if (existing) {
        const { error } = await supabase.from('meeting_attendance').update({ status, remarks: autoRemarks || null }).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('meeting_attendance').insert({
          meeting_id: meeting.id,
          invitee_id: inviteeId,
          status,
          marked_by: user!.id,
          remarks: autoRemarks || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting-attendance', meeting.id] }),
  });

  const presentCount = attendance?.filter((a) => a.status === 'present').length || 0;
  const totalCount = invitees?.length || 0;
  const mandatoryPresent = invitees?.filter((inv) => inv.is_mandatory && attendance?.find((a) => a.invitee_id === inv.id && a.status === 'present')).length || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">{presentCount} Present / {totalCount} Total</Badge>
          <Badge variant="secondary" className="text-xs">{mandatoryPresent} Mandatory present</Badge>
        </div>
        {!readOnly && <Button size="sm" variant="outline" onClick={() => setShowAddPerson(true)} className="h-9 gap-1"><Plus className="h-3.5 w-3.5" /> Add Person</Button>}
      </div>

      {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
        <div className="space-y-2">
          {invitees?.map((inv) => {
            const att = attendance?.find((a) => a.invitee_id === inv.id);
            const name = (inv as any).user?.full_name || inv.guest_name || 'Unknown';
            const dept = (inv as any).dept?.name || '';
            return (
              <Card key={inv.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {dept && <span className="text-xs text-muted-foreground">{dept}</span>}
                        {inv.is_mandatory && <Badge className="text-[10px] bg-primary/10 text-primary">Mandatory</Badge>}
                      </div>
                    </div>
                    {readOnly ? (
                      <Badge className={cn('text-[10px]', att?.status === 'present' ? 'bg-rag-green/20 text-success' : att?.status === 'excused' ? 'bg-rag-amber/20 text-warning' : 'bg-muted text-muted-foreground')}>
                        {att?.status || 'Not marked'}
                      </Badge>
                    ) : (
                      <div className="flex gap-1">
                        {(['present', 'absent', 'excused'] as AttendanceStatus[]).map((s) => (
                          <Button
                            key={s}
                            size="sm"
                            variant={att?.status === s ? 'default' : 'outline'}
                            className={cn('h-8 text-xs capitalize', att?.status === s && s === 'present' && 'bg-rag-green text-white', att?.status === s && s === 'absent' && 'bg-destructive text-white')}
                            onClick={() => markAttendanceMutation.mutate({ inviteeId: inv.id, status: s })}
                          >
                            {s}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  {att?.remarks && <p className="text-xs text-muted-foreground mt-1">{att.remarks}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAddPerson} onOpenChange={setShowAddPerson}>
        <DialogContent className={cn(isMobile && 'h-full max-h-full w-full max-w-full rounded-none border-0', 'sm:max-w-md')}>
          <DialogHeader><DialogTitle>Add Person</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Select User</Label>
              <Select value={addUserId} onValueChange={(v) => { setAddUserId(v); setGuestName(''); }}>
                <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Search user..." /></SelectTrigger>
                <SelectContent>{allUsers?.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name} ({u.email})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground text-center">— or add as guest —</p>
            <div><Label>Guest Name</Label><Input value={guestName} onChange={(e) => { setGuestName(e.target.value); setAddUserId(''); }} className="h-11 mt-1" /></div>
            <div><Label>Guest Designation</Label><Input value={guestDesignation} onChange={(e) => setGuestDesignation(e.target.value)} className="h-11 mt-1" /></div>
            <Button onClick={() => addInviteeMutation.mutate()} disabled={(!addUserId && !guestName) || addInviteeMutation.isPending} className="w-full h-12">Add</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── NOTES & DISCUSSION TAB (FIX 2: merged) ─────────────────────────────
function NotesTab({ meeting, readOnly }: { meeting: any; readOnly: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState(meeting.summary || '');
  const debounceRef = useRef<NodeJS.Timeout>();

  const saveSummary = useCallback((val: string) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await supabase.from('meetings').update({ summary: val }).eq('id', meeting.id);
    }, 1000);
  }, [meeting.id]);

  const { data: points } = useQuery({
    queryKey: ['discussion-points', meeting.id],
    queryFn: async () => {
      const { data } = await supabase.from('meeting_discussion_points').select('*').eq('meeting_id', meeting.id).order('sequence');
      return data || [];
    },
  });

  const [newPointTitle, setNewPointTitle] = useState('');

  const addPointMutation = useMutation({
    mutationFn: async () => {
      const seq = (points?.length || 0) + 1;
      const { error } = await supabase.from('meeting_discussion_points').insert({
        meeting_id: meeting.id,
        title: newPointTitle,
        sequence: seq,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussion-points', meeting.id] });
      setNewPointTitle('');
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ pointId, notes }: { pointId: string; notes: string }) => {
      await supabase.from('meeting_discussion_points').update({ notes }).eq('id', pointId);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ pointId, direction }: { pointId: string; direction: 'up' | 'down' }) => {
      if (!points) return;
      const idx = points.findIndex((p) => p.id === pointId);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= points.length) return;
      await Promise.all([
        supabase.from('meeting_discussion_points').update({ sequence: points[swapIdx].sequence }).eq('id', points[idx].id),
        supabase.from('meeting_discussion_points').update({ sequence: points[idx].sequence }).eq('id', points[swapIdx].id),
      ]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['discussion-points', meeting.id] }),
  });

  return (
    <div className="space-y-6">
      {/* Meeting Notes */}
      <div>
        <Label className="text-sm font-semibold">Meeting Notes</Label>
        <Textarea
          value={summary}
          onChange={(e) => { setSummary(e.target.value); saveSummary(e.target.value); }}
          placeholder="Free-text meeting notes..."
          rows={4}
          disabled={readOnly}
          className="mt-1"
        />
      </div>

      {/* Discussion Points (optional) */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Discussion Points <span className="text-muted-foreground font-normal">(optional)</span></h3>
        {points?.map((p, idx) => (
          <DiscussionPointCard
            key={p.id}
            point={p}
            readOnly={readOnly}
            onUpdateNotes={(notes) => updateNoteMutation.mutate({ pointId: p.id, notes })}
            onMoveUp={() => reorderMutation.mutate({ pointId: p.id, direction: 'up' })}
            onMoveDown={() => reorderMutation.mutate({ pointId: p.id, direction: 'down' })}
            isFirst={idx === 0}
            isLast={idx === (points?.length || 0) - 1}
          />
        ))}
        {!readOnly && (
          <div className="flex gap-2">
            <Input value={newPointTitle} onChange={(e) => setNewPointTitle(e.target.value)} placeholder="Add discussion point..." className="h-10" onKeyDown={(e) => e.key === 'Enter' && newPointTitle && addPointMutation.mutate()} />
            <Button size="sm" onClick={() => addPointMutation.mutate()} disabled={!newPointTitle} className="h-10"><Plus className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DiscussionPointCard({ point, readOnly, onUpdateNotes, onMoveUp, onMoveDown, isFirst, isLast }: {
  point: any; readOnly: boolean; onUpdateNotes: (n: string) => void; onMoveUp: () => void; onMoveDown: () => void; isFirst: boolean; isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(point.notes || '');
  const debRef = useRef<NodeJS.Timeout>();

  const handleNotesChange = (val: string) => {
    setNotes(val);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => onUpdateNotes(val), 1000);
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <button className="flex items-center gap-1 text-sm font-medium text-left flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{point.title}</span>
          </button>
          {!readOnly && (
            <div className="flex gap-0.5 shrink-0">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveUp} disabled={isFirst}><ArrowUp className="h-3 w-3" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onMoveDown} disabled={isLast}><ArrowDown className="h-3 w-3" /></Button>
            </div>
          )}
        </div>
        {expanded && (
          <Textarea value={notes} onChange={(e) => handleNotesChange(e.target.value)} placeholder="Notes..." rows={2} disabled={readOnly} className="mt-2 text-sm" />
        )}
      </CardContent>
    </Card>
  );
}

// ─── DECISIONS TAB (FIX 3: expandable decisions, FIX 5: validation) ─────────
function DecisionsTab({ meeting, readOnly }: { meeting: any; readOnly: boolean }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [showAdd, setShowAdd] = useState(false);
  const [decisionText, setDecisionText] = useState('');
  const [linkedPointId, setLinkedPointId] = useState('');
  const [createTask, setCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskOwnerId, setTaskOwnerId] = useState('');
  const [taskDeptId, setTaskDeptId] = useState('');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: decisions } = useQuery({
    queryKey: ['meeting-decisions', meeting.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('meeting_decisions')
        .select('*, point:meeting_discussion_points(title), task:tasks!fk_decision_task(task_number, title, status)')
        .eq('meeting_id', meeting.id).order('created_at');
      return data || [];
    },
  });

  const { data: points } = useQuery({
    queryKey: ['discussion-points-for-decisions', meeting.id],
    queryFn: async () => {
      const { data } = await supabase.from('meeting_discussion_points').select('id, title').eq('meeting_id', meeting.id).order('sequence');
      return data || [];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['departments-for-task'],
    queryFn: async () => {
      const { data } = await supabase.from('department').select('id, name').eq('is_active', true).order('display_order');
      return data || [];
    },
    enabled: createTask,
  });

  const { data: deptUsers } = useQuery({
    queryKey: ['dept-users-decision', taskDeptId],
    queryFn: async () => {
      const { data: uds } = await supabase.from('user_departments').select('user_id').eq('department_id', taskDeptId);
      if (!uds?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', uds.map((u) => u.user_id)).eq('is_active', true);
      return data || [];
    },
    enabled: !!taskDeptId,
  });

  const addDecisionMutation = useMutation({
    mutationFn: async () => {
      // FIX 5: Validate decision text
      if (!decisionText.trim()) throw new Error('Please enter decision text first');

      let linkedTaskId: string | null = null;

      if (createTask) {
        if (!taskTitle || !taskOwnerId || !taskDeptId || !taskDueDate) {
          throw new Error('Please fill all required task fields');
        }
        if (taskDueDate < today) throw new Error('Due date cannot be in the past');

        const { data: taskData, error: taskErr } = await supabase.from('tasks').insert({
          title: taskTitle,
          department_id: taskDeptId,
          owner_id: taskOwnerId,
          assigned_by: user!.id,
          priority: taskPriority,
          due_date: taskDueDate,
          origin_type: 'meeting',
          origin_meeting_id: meeting.id,
          created_by: user!.id,
        }).select('id').single();
        if (taskErr) throw taskErr;
        linkedTaskId = taskData.id;
        logAudit('tasks', taskData.id, 'INSERT', null, { title: taskTitle, origin_type: 'meeting', origin_meeting_id: meeting.id });
      }

      const { data, error } = await supabase.from('meeting_decisions').insert({
        meeting_id: meeting.id,
        decision_text: decisionText.trim(),
        discussion_point_id: linkedPointId?.trim() || null,
        linked_task_id: linkedTaskId,
        created_by: user!.id,
      }).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: 'Decision recorded' });
      queryClient.invalidateQueries({ queryKey: ['meeting-decisions', meeting.id] });
      queryClient.invalidateQueries({ queryKey: ['meeting-tasks', meeting.id] });
      setShowAdd(false);
      setDecisionText('');
      setLinkedPointId('');
      setCreateTask(false);
      setTaskTitle('');
      setTaskOwnerId('');
      setTaskDeptId('');
      setTaskDueDate('');
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} className="h-9 gap-1"><Plus className="h-3.5 w-3.5" /> Add Decision</Button>
      )}

      {/* FIX 3: Expandable decision cards */}
      <div className="space-y-2">
        {decisions?.map((d) => {
          const isExpanded = expandedId === d.id;
          return (
            <Card key={d.id} className="cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : d.id)}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm', !isExpanded && 'line-clamp-2')}>{d.decision_text}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {(d as any).point && <Badge variant="secondary" className="text-[10px]">Re: {(d as any).point.title}</Badge>}
                  {(d as any).task && <Badge className="text-[10px] bg-primary/10 text-primary">Task #{(d as any).task.task_number}</Badge>}
                </div>
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Full Decision</span>
                      <p className="text-sm mt-0.5">{d.decision_text}</p>
                    </div>
                    {(d as any).point && (
                      <div>
                        <span className="text-xs text-muted-foreground">Linked Discussion Point</span>
                        <p className="text-sm mt-0.5">{(d as any).point.title}</p>
                      </div>
                    )}
                    {(d as any).task && (
                      <div>
                        <span className="text-xs text-muted-foreground">Linked Task</span>
                        <p className="text-sm mt-0.5">
                          #{(d as any).task.task_number} — {(d as any).task.title}
                          <Badge className={cn('ml-2 text-[10px]', (d as any).task.status === 'completed' ? 'bg-rag-green/20 text-success' : 'bg-primary/10 text-primary')}>
                            {(d as any).task.status?.replace('_', ' ')}
                          </Badge>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!decisions?.length && <p className="text-sm text-muted-foreground text-center py-4">No decisions recorded yet.</p>}
      </div>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className={cn(isMobile && 'h-full max-h-full w-full max-w-full rounded-none border-0', 'sm:max-w-lg')}>
          <DialogHeader><DialogTitle>Add Decision</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto">
            <div><Label>Decision *</Label><Textarea value={decisionText} onChange={(e) => setDecisionText(e.target.value)} rows={2} className="mt-1" placeholder="Enter decision text..." /></div>
            <div>
              <Label>Link to Discussion Point <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Select value={linkedPointId} onValueChange={setLinkedPointId}>
                <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">None</SelectItem>
                  {points?.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} className="rounded" />
              Create linked task
            </label>

            {createTask && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <div><Label>Task Title *</Label><Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="h-11 mt-1" /></div>
                <div>
                  <Label>Department *</Label>
                  <Select value={taskDeptId} onValueChange={setTaskDeptId}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Owner *</Label>
                  <Select value={taskOwnerId} onValueChange={setTaskOwnerId}>
                    <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{deptUsers?.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Priority</Label>
                    <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as TaskPriority)}>
                      <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Due Date *</Label><Input type="date" min={today} value={taskDueDate} onChange={(e) => setTaskDueDate(e.target.value)} className="h-11 mt-1" /></div>
                </div>
              </div>
            )}

            <Button onClick={() => addDecisionMutation.mutate()} disabled={!decisionText.trim() || addDecisionMutation.isPending} className="w-full h-12">
              {addDecisionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save Decision
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MEETING TASKS TAB ─────────────────────────────
function MeetingTasksTab({ meeting }: { meeting: any }) {
  const [showCreate, setShowCreate] = useState(false);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['meeting-tasks', meeting.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, owner:profiles!tasks_owner_id_fkey(full_name), dept:department!tasks_department_id_fkey(name)')
        .eq('origin_meeting_id', meeting.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Tasks from this meeting</h3>
        <Button size="sm" onClick={() => setShowCreate(true)} className="h-9 gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Task
        </Button>
      </div>

      {isLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
        <div className="space-y-2">
          {tasks?.map((t) => <TaskCard key={t.id} task={t} />)}
          {!tasks?.length && <p className="text-sm text-muted-foreground text-center py-4">No tasks for this meeting.</p>}
        </div>
      )}

      {showCreate && <StandaloneTaskModal open={showCreate} onOpenChange={setShowCreate} meetingId={meeting.id} />}
    </div>
  );
}

// ─── SHARED TASK CARD ─────────────────────────────
const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-rag-amber text-white',
  medium: 'bg-primary/10 text-primary',
  low: 'bg-muted text-muted-foreground',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  open: 'bg-primary/10 text-primary',
  in_progress: 'bg-rag-amber/20 text-warning',
  blocked: 'bg-destructive/10 text-destructive',
  completed: 'bg-rag-green/20 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

function TaskCard({ task }: { task: any }) {
  const isOverdue = task.status !== 'completed' && task.status !== 'cancelled' && new Date(task.due_date) < new Date();
  return (
    <Card className={cn(isOverdue && 'border-destructive/30')}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{task.task_number}</span>
              <p className="text-sm font-medium truncate">{task.title}</p>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{(task as any).owner?.full_name}</span>
              {(task as any).dept?.name && <Badge variant="secondary" className="text-[10px]">{(task as any).dept.name}</Badge>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={cn('text-[10px]', TASK_STATUS_COLORS[task.status])}>{task.status.replace('_', ' ')}</Badge>
            <Badge className={cn('text-[10px]', PRIORITY_COLORS[task.priority])}>{task.priority}</Badge>
          </div>
        </div>
        {isOverdue && (
          <p className="text-xs text-destructive mt-1">
            Overdue by {Math.ceil((Date.now() - new Date(task.due_date).getTime()) / 86400000)} days
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StandaloneTaskModal({ open, onOpenChange, meetingId }: { open: boolean; onOpenChange: (v: boolean) => void; meetingId?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deptId, setDeptId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: departments } = useQuery({
    queryKey: ['departments-for-task-modal'],
    queryFn: async () => {
      const { data } = await supabase.from('department').select('id, name').eq('is_active', true).order('display_order');
      return data || [];
    },
    enabled: open,
  });

  const { data: deptUsers } = useQuery({
    queryKey: ['dept-users-task-modal', deptId],
    queryFn: async () => {
      const { data: uds } = await supabase.from('user_departments').select('user_id').eq('department_id', deptId);
      if (!uds?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', uds.map((u) => u.user_id)).eq('is_active', true);
      return data || [];
    },
    enabled: !!deptId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (dueDate < today) throw new Error('Due date cannot be in the past');
      const payload = buildTaskPayload({
        title,
        description,
        departmentId: deptId,
        ownerId,
        assignedBy: user!.id,
        createdBy: user!.id,
        priority,
        dueDate,
        meetingId,
      });
      const { data, error } = await supabase.from('tasks').insert(payload).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Task created' });
      queryClient.invalidateQueries({ queryKey: ['meeting-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
      logAudit('tasks', data.id, 'INSERT', null, { title, origin_type: meetingId ? 'meeting' : 'standalone' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(isMobile && 'h-full max-h-full w-full max-w-full rounded-none border-0', 'sm:max-w-lg')}>
        <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
        {meetingId && <p className="text-xs text-muted-foreground">Linked to this meeting</p>}
        <div className="space-y-3 overflow-y-auto">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 mt-1" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1" /></div>
          <div>
            <Label>Department *</Label>
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Owner *</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{deptUsers?.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Due Date *</Label><Input type="date" min={today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-11 mt-1" /></div>
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!title || !deptId || !ownerId || !dueDate || createMutation.isPending} className="w-full h-12">
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
