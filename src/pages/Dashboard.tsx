import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, isYesterday, isToday } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  CalendarIcon, AlertTriangle, ListTodo, AlertCircle,
  CalendarDays, ChevronRight, ChevronDown, FileWarning, ChevronsUpDown, Download,
} from 'lucide-react';
import { KpiExportModal } from '@/components/KpiExportModal';
import { startOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { buildCollapseSummary, getDeptCollapseKey } from '@/lib/dashboardUtils';
import { getMtdDateRange, calculateMtd, computeRagFromValue } from '@/lib/mtdUtils';
import { filterItemsForKpi, EMPTY_PROJECT_TRACKER_MESSAGE, STATUS_LABELS } from '@/lib/projectTrackerExpansion';
import { formatIndianNumber } from '@/lib/formatNumber';
import { PmScheduleGrid } from '@/components/pm/PmScheduleGrid';
import { toIsoDate, daysBetween } from '@/lib/pmSchedule';

function detectPmLine(name: string): 'SFM' | 'RFM' | null {
  const n = name.toLowerCase();
  if (!n.includes('pm schedule')) return null;
  if (n.includes('sfm')) return 'SFM';
  if (n.includes('rfm')) return 'RFM';
  return null;
}

type RagStatus = 'red' | 'amber' | 'green';

function ragRowStyle(status: RagStatus): React.CSSProperties {
  return {
    background: `var(--rag-${status === 'green' ? 'green' : status}-bg)`,
    borderLeft: `4px solid var(--rag-${status === 'green' ? 'green' : status}-border)`,
  };
}

function ragBadgeStyle(status: RagStatus): React.CSSProperties {
  return {
    background: `var(--rag-${status}-badge-bg)`,
    color: `var(--rag-${status}-badge-text)`,
    border: `1px solid var(--rag-${status}-badge-border)`,
  };
}

function getKpiSubtitle(date: Date): string {
  if (isYesterday(date)) return "Showing yesterday's data · T4 reviews cover the previous day";
  if (isToday(date)) return "⚠ Today's production is ongoing — data may be incomplete";
  return `Showing data for ${format(date, 'EEEE, dd MMM yyyy')}`;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  });
  const [calOpen, setCalOpen] = useState(false);
  const [detailKpi, setDetailKpi] = useState<any>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_master')
        .select('*, department:department!kpi_master_department_id_fkey(id, name, code, display_order)')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: allDepartments } = useQuery({
    queryKey: ['dashboard-all-departments'],
    queryFn: async () => {
      const { data } = await supabase.from('department').select('id, name').eq('is_active', true);
      return data || [];
    },
  });

  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['dashboard-entries', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_entries')
        .select('*')
        .eq('reporting_date', dateStr);
      if (error) throw error;
      return data;
    },
  });

  const mtdRange = useMemo(() => getMtdDateRange(dateStr), [dateStr]);

  const { data: mtdEntries } = useQuery({
    queryKey: ['dashboard-mtd-entries', mtdRange.from, mtdRange.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_entries')
        .select('kpi_id, actual_value, reporting_date')
        .gte('reporting_date', mtdRange.from)
        .lte('reporting_date', mtdRange.to);
      if (error) throw error;
      return data;
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

  const { data: projectItems } = useQuery({
    queryKey: ['dashboard-project-items'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_tracker_items').select('*');
      if (error) throw error;
      return data;
    },
  });

  const { data: kpiTasks } = useQuery({
    queryKey: ['dashboard-kpi-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('origin_kpi_entry_id').not('origin_kpi_entry_id', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  // PM Schedule summary data for the selected month (used by SFM/RFM PM Schedule rows)
  const pmMonthStart = useMemo(() => format(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1), 'yyyy-MM-dd'), [selectedDate]);
  const pmMonthEnd = useMemo(() => format(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0), 'yyyy-MM-dd'), [selectedDate]);

  const { data: pmMachines } = useQuery({
    queryKey: ['dashboard-pm-machines'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pm_machines').select('id, line').eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pmPlans } = useQuery({
    queryKey: ['dashboard-pm-plans', pmMonthStart, pmMonthEnd],
    queryFn: async () => {
      const { data, error } = await supabase.from('pm_plan').select('machine_id, planned_date')
        .gte('planned_date', pmMonthStart).lte('planned_date', pmMonthEnd);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pmActuals } = useQuery({
    queryKey: ['dashboard-pm-actuals', pmMonthStart, pmMonthEnd],
    queryFn: async () => {
      const { data, error } = await supabase.from('pm_actual').select('machine_id, actual_date')
        .gte('actual_date', pmMonthStart).lte('actual_date', pmMonthEnd);
      if (error) throw error;
      return data || [];
    },
  });

  const pmSummaryByLine = useMemo(() => {
    const today = toIsoDate(new Date());
    const out: Record<'SFM' | 'RFM', { done: number; total: number; overdue: number }> = {
      SFM: { done: 0, total: 0, overdue: 0 },
      RFM: { done: 0, total: 0, overdue: 0 },
    };
    if (!pmMachines || !pmPlans) return out;
    const machineLine: Record<string, 'SFM' | 'RFM'> = {};
    pmMachines.forEach((m) => {
      if (m.line === 'SFM' || m.line === 'RFM') machineLine[m.id] = m.line;
    });
    const overdueMachines: Record<'SFM' | 'RFM', Set<string>> = { SFM: new Set(), RFM: new Set() };
    (pmPlans as any[]).forEach((p) => {
      const line = machineLine[p.machine_id];
      if (!line) return;
      out[line].total += 1;
      const matched = (pmActuals as any[] | undefined)?.some(
        (a) => a.machine_id === p.machine_id && a.actual_date >= p.planned_date,
      );
      if (matched) out[line].done += 1;
      else if (daysBetween(p.planned_date, today) > 2) overdueMachines[line].add(p.machine_id);
    });
    out.SFM.overdue = overdueMachines.SFM.size;
    out.RFM.overdue = overdueMachines.RFM.size;
    return out;
  }, [pmMachines, pmPlans, pmActuals]);


  const { data: overdueTasks } = useQuery({
    queryKey: ['dashboard-overdue'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .lt('due_date', today)
        .not('status', 'in', '("completed","cancelled")');
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: openTasks } = useQuery({
    queryKey: ['dashboard-open-tasks'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .not('status', 'in', '("completed","cancelled")');
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: nextMeeting } = useQuery({
    queryKey: ['dashboard-next-meeting'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('meetings')
        .select('title, scheduled_date, scheduled_start_time')
        .gte('scheduled_date', today)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_date')
        .order('scheduled_start_time')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const entryMap = useMemo(() => {
    const m: Record<string, any> = {};
    entries?.forEach((e) => { m[e.kpi_id] = e; });
    return m;
  }, [entries]);

  const taskEntryIds = useMemo(() => {
    const s = new Set<string>();
    kpiTasks?.forEach((t) => { if (t.origin_kpi_entry_id) s.add(t.origin_kpi_entry_id); });
    return s;
  }, [kpiTasks]);

  const grouped = useMemo(() => {
    if (!kpis) return [];
    const map = new Map<string, { dept: any; kpis: any[] }>();
    kpis.forEach((k) => {
      const dept = k.department as any;
      if (!dept) return;
      if (!map.has(dept.id)) map.set(dept.id, { dept, kpis: [] });
      map.get(dept.id)!.kpis.push(k);
    });
    return Array.from(map.values()).sort((a, b) => a.dept.display_order - b.dept.display_order);
  }, [kpis]);

  const piByKpi = useMemo(() => {
    const m: Record<string, any[]> = {};
    projectItems?.forEach((p) => {
      if (!m[p.kpi_id]) m[p.kpi_id] = [];
      m[p.kpi_id].push(p);
    });
    return m;
  }, [projectItems]);

  const redKpisToday = useMemo(() => {
    return entries?.filter((e) => e.computed_status === 'red').length || 0;
  }, [entries]);

  const isLoading = kpisLoading || entriesLoading;
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Department collapse state, initialized from localStorage
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>(() => {
    const state: Record<string, boolean> = {};
    if (typeof window !== 'undefined') {
      grouped.forEach(({ dept }) => {
        const key = getDeptCollapseKey(dept.code);
        state[dept.id] = localStorage.getItem(key) === 'true';
      });
    }
    return state;
  });

  // Re-sync when grouped changes (lazy init only runs once)
  useMemo(() => {
    if (typeof window === 'undefined') return;
    setCollapsedDepts((prev) => {
      const next = { ...prev };
      grouped.forEach(({ dept }) => {
        if (!(dept.id in next)) {
          next[dept.id] = localStorage.getItem(getDeptCollapseKey(dept.code)) === 'true';
        }
      });
      return next;
    });
  }, [grouped]);

  const toggleDept = useCallback((deptId: string, deptCode: string) => {
    setCollapsedDepts((prev) => {
      const newVal = !prev[deptId];
      localStorage.setItem(getDeptCollapseKey(deptCode), String(newVal));
      return { ...prev, [deptId]: newVal };
    });
  }, []);

  const collapseAll = useCallback(() => {
    setCollapsedDepts((prev) => {
      const next = { ...prev };
      grouped.forEach(({ dept }) => {
        next[dept.id] = true;
        localStorage.setItem(getDeptCollapseKey(dept.code), 'true');
      });
      return next;
    });
  }, [grouped]);

  const expandAll = useCallback(() => {
    setCollapsedDepts((prev) => {
      const next = { ...prev };
      grouped.forEach(({ dept }) => {
        next[dept.id] = false;
        localStorage.setItem(getDeptCollapseKey(dept.code), 'false');
      });
      return next;
    });
  }, [grouped]);

  const operationsSection = (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Operations Overview</h2>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>As of today, {format(new Date(), 'dd MMM yyyy')}</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatTile label="Overdue Tasks" value={overdueTasks ?? '—'} accentColor="var(--rag-red-border)" icon={<AlertTriangle className="h-5 w-5" style={{ color: 'var(--rag-red-border)' }} />} onClick={() => navigate('/tasks')} />
        <StatTile label="Open Tasks" value={openTasks ?? '—'} accentColor="var(--color-primary)" icon={<ListTodo className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />} onClick={() => navigate('/tasks')} />
        <StatTile label="Red KPIs" value={redKpisToday} accentColor="var(--rag-amber-border)" icon={<AlertCircle className="h-5 w-5" style={{ color: 'var(--rag-amber-border)' }} />} onClick={() => navigate('/kpi/entry')} />
        <StatTile label="Next Meeting" value={nextMeeting ? format(new Date(nextMeeting.scheduled_date + 'T00:00'), 'dd MMM') : '—'} accentColor="var(--rag-green-border)" icon={<CalendarDays className="h-5 w-5" style={{ color: 'var(--rag-green-border)' }} />} onClick={() => navigate('/meetings')} subtitle={nextMeeting?.title} />
      </div>
    </section>
  );

  const kpiSection = (
    <section>
      {/* KPI Section Header */}
      <div
        className="rounded-lg px-4 py-3 mb-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>KPI Performance</h2>
            <p className="text-xs mt-0.5" style={{ color: isToday(selectedDate) ? 'var(--rag-amber-border)' : 'var(--text-muted)' }}>
              {getKpiSubtitle(selectedDate)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Popover open={calOpen} onOpenChange={setCalOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0 gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, 'dd MMM yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => { if (d) { setSelectedDate(d); setCalOpen(false); } }}
                  disabled={(d) => d >= new Date(new Date().toDateString())}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setExportOpen(true)}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>
      </div>

      {/* Collapse/Expand All */}
      {!isLoading && grouped.length > 0 && (
        <div className="flex justify-end gap-2 mb-2">
          <button
            onClick={collapseAll}
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Collapse All
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>|</span>
          <button
            onClick={expandAll}
            className="text-xs font-medium hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            Expand All
          </button>
        </div>
      )}

      {/* KPI Grid */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="themed-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card className="themed-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
          <CardContent className="p-8 text-center">
            <FileWarning className="mx-auto h-10 w-10 mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No active KPIs configured.</p>
            <Button variant="outline" className="mt-3" onClick={() => navigate('/kpi/master')}>Manage KPIs</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Column header row */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] uppercase tracking-wider font-semibold"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-card)' }}
          >
            <div className="flex-1 min-w-0">KPI Name</div>
            <span className="hidden sm:inline w-12 text-right">Target</span>
            <span className="w-16 text-right">Yesterday</span>
            <span className="hidden sm:inline w-16 text-right">MTD</span>
            <span className="w-16 text-center">Status</span>
            <span className="w-4" />
          </div>
          {grouped.map(({ dept, kpis: deptKpis }) => {
            const deptEntries = deptKpis.map((k) => ({ kpi: k, entry: entryMap[k.id] }));
            const redCount = deptEntries.filter((d) => d.entry?.computed_status === 'red').length;
            const amberCount = deptEntries.filter((d) => d.entry?.computed_status === 'amber').length;
            const greenCount = deptEntries.filter((d) => d.entry?.computed_status === 'green').length;
            const missingCount = deptEntries.filter((d) => d.kpi.kpi_type === 'numeric' && !d.entry).length;
            const isCollapsed = !!collapsedDepts[dept.id];
            const summary = buildCollapseSummary(deptEntries.map(d => d.entry?.computed_status ?? null));

            return (
              <Card key={dept.id} className="themed-card overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}>
                <div
                  className="pl-3 pr-4 py-3 flex items-center justify-between cursor-pointer select-none hover:opacity-80 transition-opacity"
                  style={{ borderLeft: '4px solid var(--color-primary)' }}
                  onClick={() => toggleDept(dept.id, dept.code)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                    )}
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{dept.name}</h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {isCollapsed ? (
                      <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {summary.total} KPIs
                        {summary.red > 0 && <><span style={{ color: 'var(--rag-red-border)' }}>🔴 {summary.red}</span></>}
                        {summary.amber > 0 && <><span style={{ color: 'var(--rag-amber-border)' }}>🟡 {summary.amber}</span></>}
                        {summary.green > 0 && <><span style={{ color: 'var(--rag-green-border)' }}>🟢 {summary.green}</span></>}
                        {summary.red === 0 && summary.amber === 0 && summary.green === 0 && summary.total > 0 && (
                          <span style={{ color: 'var(--text-muted)' }}>— {summary.total} no data</span>
                        )}
                      </span>
                    ) : (
                      <>
                        {redCount > 0 && <span style={{ color: 'var(--rag-red-border)' }}>🔴 {redCount}</span>}
                        {amberCount > 0 && <span style={{ color: 'var(--rag-amber-border)' }}>🟡 {amberCount}</span>}
                        {greenCount > 0 && <span style={{ color: 'var(--rag-green-border)' }}>🟢 {greenCount}</span>}
                        {missingCount > 0 && <span style={{ color: 'var(--text-muted)' }}>⬜ {missingCount}</span>}
                      </>
                    )}
                  </div>
                </div>

                {!isCollapsed && <div style={{ borderTop: '1px solid var(--border-card)' }}>
                  {deptKpis.map((kpi) => {
                    const entry = entryMap[kpi.id];
                    const status = entry?.computed_status as RagStatus | null;
                    const isProjectTracker = kpi.kpi_type === 'project_tracker';
                    const isDescriptive = kpi.kpi_type === 'descriptive';
                    const pmLine = detectPmLine(kpi.name);
                    const items = piByKpi[kpi.id] || [];
                    const activeItems = items.filter((i) => i.status === 'active').length;
                    const completedItems = items.filter((i) => i.status === 'completed').length;
                    const hasNoAction = status === 'red' && entry && !taskEntryIds.has(entry.id);
                    const isExpanded = expandedRow === kpi.id;
                    const mtdVal = (!isProjectTracker && !isDescriptive) ? calculateMtd(mtdByKpi[kpi.id] || [], kpi.mtd_aggregation ?? 'sum', selectedDate) : null;
                    const mtdRag = mtdVal !== null ? computeRagFromValue(mtdVal, kpi) : null;

                    const rowStyle: React.CSSProperties = status
                      ? ragRowStyle(status)
                      : (isProjectTracker || isDescriptive ? {} : { background: 'var(--rag-missing-bg)' });

                    return (
                      <div key={kpi.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                        <div
                          className="flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors min-h-[44px]"
                          style={rowStyle}
                          onClick={() => {
                            if (isMobile && !pmLine) setDetailKpi({ kpi, entry });
                            else setExpandedRow(isExpanded ? null : kpi.id);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{kpi.name}</p>
                          </div>
                          {pmLine ? (
                            (() => {
                              const s = pmSummaryByLine[pmLine];
                              return (
                                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                                  {s.done} done / {s.total} total
                                  {s.overdue > 0 && (
                                    <span className="ml-1.5" style={{ color: 'var(--rag-red-border)' }}>
                                      • {s.overdue} overdue
                                    </span>
                                  )}
                                </span>
                              );
                            })()
                          ) : isProjectTracker ? (
                            <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                              {activeItems} Active / {completedItems} Completed
                            </span>
                          ) : isDescriptive ? (
                            <span className="text-xs truncate max-w-[120px]" style={{ color: 'var(--text-secondary)' }}>
                              {entry?.text_value ? entry.text_value.slice(0, 50) : '—'}
                            </span>
                          ) : (
                            <>
                              <span className="text-xs hidden sm:inline w-12 text-right" style={{ color: 'var(--text-muted)' }}>{formatIndianNumber(kpi.target_value)}</span>
                              <span className="text-sm font-semibold w-16 text-right" style={{ color: 'var(--text-primary)' }}>{formatIndianNumber(entry?.actual_value)}</span>
                              <span className="text-xs hidden sm:inline w-16 text-right" style={{ color: mtdRag ? `var(--rag-${mtdRag}-border)` : 'var(--text-muted)' }}>
                                {formatIndianNumber(mtdVal)}
                              </span>
                              <span className="w-16 flex justify-center">
                              {status ? (
                                <Badge className="text-xs rounded-full px-2.5 py-0.5 font-medium" style={ragBadgeStyle(status)}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </Badge>
                              ) : (
                                <Badge className="text-xs rounded-full px-2.5 py-0.5 font-medium" style={{ background: 'var(--rag-missing-bg)', color: 'var(--rag-missing-text)', border: '1px solid var(--border-card)' }}>Missing</Badge>
                              )}
                              </span>
                            </>
                          )}
                          {hasNoAction && (
                            <span title="No action assigned">
                              <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: 'var(--rag-red-border)' }} />
                            </span>
                          )}
                          <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', isExpanded && 'rotate-90')} style={{ color: 'var(--text-muted)' }} />
                        </div>
                        {isExpanded && pmLine && (
                          <div className="px-3 py-3" style={{ background: 'var(--rag-missing-bg)', borderTop: '1px solid var(--border-card)' }}>
                            <PmScheduleGrid month={selectedDate} line={pmLine} height="compact" />
                          </div>
                        )}
                        {!isMobile && isExpanded && !pmLine && isProjectTracker && (
                          <div className="px-4 py-2 text-sm" style={{ background: 'var(--rag-missing-bg)', borderTop: '1px solid var(--border-card)', color: 'var(--text-secondary)' }}>
                            {(() => {
                              const trackerItems = filterItemsForKpi(projectItems as any, kpi.id);
                              if (trackerItems.length === 0) {
                                return <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{EMPTY_PROJECT_TRACKER_MESSAGE}</p>;
                              }
                              return (
                                <ul className="space-y-1.5">
                                  {trackerItems.map((it) => (
                                    <li key={it.id} className="flex items-center justify-between gap-2">
                                      <span className="truncate" style={{ color: 'var(--text-primary)' }}>{it.title}</span>
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        {STATUS_LABELS[it.status as keyof typeof STATUS_LABELS] ?? it.status}
                                      </Badge>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>
                        )}
                        {!isMobile && isExpanded && !pmLine && !isProjectTracker && entry && (
                          <div className="px-4 py-2 text-sm" style={{ background: 'var(--rag-missing-bg)', borderTop: '1px solid var(--border-card)', color: 'var(--text-secondary)' }}>
                            <p><span className="font-medium">Remarks:</span> {entry.remarks || 'None'}</p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                              Submitted: {format(new Date(entry.submitted_at), 'dd MMM yyyy HH:mm')}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Welcome back{profile ? `, ${profile.full_name}` : ''}.
        </p>
      </div>

      {/* Mobile: Operations first, then KPI. Desktop: KPI first, then Operations */}
      {isMobile ? (
        <>
          {operationsSection}
          <div className="h-px" style={{ background: 'var(--border-card)' }} />
          {kpiSection}
        </>
      ) : (
        <>
          {kpiSection}
          <div className="h-px" style={{ background: 'var(--border-card)' }} />
          {operationsSection}
        </>
      )}

      {/* Mobile KPI detail sheet */}
      <Sheet open={!!detailKpi} onOpenChange={(o) => !o && setDetailKpi(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>{detailKpi?.kpi?.name}</SheetTitle>
          </SheetHeader>
          {detailKpi?.entry ? (
            <div className="space-y-3 py-4 text-sm">
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Actual</span>
                <span className="font-semibold">{detailKpi.entry.actual_value != null ? formatIndianNumber(detailKpi.entry.actual_value) : (detailKpi.entry.text_value ?? '—')}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Target</span>
                <span>{formatIndianNumber(detailKpi.kpi.target_value)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-secondary)' }}>Status</span>
                {detailKpi.entry.computed_status ? (
                  <Badge className="text-xs" style={ragBadgeStyle(detailKpi.entry.computed_status as RagStatus)}>
                    {detailKpi.entry.computed_status}
                  </Badge>
                ) : <span>—</span>}
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Remarks</span>
                <p className="mt-1" style={{ color: 'var(--text-primary)' }}>{detailKpi.entry.remarks || 'None'}</p>
              </div>
            </div>
          ) : (
            <p className="py-4 text-sm" style={{ color: 'var(--text-muted)' }}>No entry for this date.</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatTile({
  label, value, accentColor, icon, onClick, subtitle,
}: {
  label: string;
  value: number | string;
  accentColor: string;
  icon: React.ReactNode;
  onClick: () => void;
  subtitle?: string;
}) {
  return (
    <Card
      className="themed-card cursor-pointer hover:shadow-md transition-shadow"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)', borderLeft: `4px solid ${accentColor}` }}
      onClick={onClick}
    >
      <CardContent className="p-3 md:p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
          <p className="text-xs md:text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</p>
          {subtitle && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
