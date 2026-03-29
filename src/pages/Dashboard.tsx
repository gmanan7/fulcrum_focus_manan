import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  CalendarIcon, AlertTriangle, ListTodo, AlertCircle,
  CalendarDays, ChevronRight, FileWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RagStatus = 'red' | 'amber' | 'green';

const ragRowClass: Record<RagStatus, string> = {
  red: 'bg-red-50 border-l-4 border-red-400',
  amber: 'bg-amber-50 border-l-4 border-amber-400',
  green: 'bg-emerald-50 border-l-4 border-emerald-400',
};

const ragBadgeClass: Record<RagStatus, string> = {
  red: 'bg-red-100 text-red-700 border border-red-300',
  amber: 'bg-amber-100 text-amber-700 border border-amber-300',
  green: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
};

export default function Dashboard() {
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calOpen, setCalOpen] = useState(false);
  const [detailKpi, setDetailKpi] = useState<any>(null);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  // Fetch all active KPIs with department info
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

  // Fetch entries for the selected date
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

  // Fetch project tracker items for project_tracker KPIs
  const { data: projectItems } = useQuery({
    queryKey: ['dashboard-project-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_tracker_items')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch tasks linked to KPI entries (to detect red KPIs without action)
  const { data: kpiTasks } = useQuery({
    queryKey: ['dashboard-kpi-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('origin_kpi_entry_id')
        .not('origin_kpi_entry_id', 'is', null);
      if (error) throw error;
      return data;
    },
  });

  // Quick stats
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

  // Build entry map
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

  // Group KPIs by department
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

  // Project items map
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Welcome back{profile ? `, ${profile.full_name}` : ''}.
          </p>
        </div>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto justify-start gap-2">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, 'dd MMM yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => { if (d) { setSelectedDate(d); setCalOpen(false); } }}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatTile
          label="Overdue Tasks"
          value={overdueTasks ?? '—'}
          accent="border-l-red-400"
          icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
          onClick={() => navigate('/tasks')}
        />
        <StatTile
          label="Open Tasks"
          value={openTasks ?? '—'}
          accent="border-l-blue-400"
          icon={<ListTodo className="h-5 w-5 text-blue-400" />}
          onClick={() => navigate('/tasks')}
        />
        <StatTile
          label="Red KPIs Today"
          value={redKpisToday}
          accent="border-l-amber-400"
          icon={<AlertCircle className="h-5 w-5 text-amber-400" />}
          onClick={() => navigate('/kpi/entry')}
        />
        <StatTile
          label="Next Meeting"
          value={nextMeeting ? format(new Date(nextMeeting.scheduled_date + 'T00:00'), 'dd MMM') : '—'}
          accent="border-l-emerald-400"
          icon={<CalendarDays className="h-5 w-5 text-emerald-400" />}
          onClick={() => navigate('/meetings')}
          subtitle={nextMeeting?.title}
        />
      </div>

      {/* KPI Status Grid */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileWarning className="mx-auto h-10 w-10 text-slate-300 mb-3" />
            <p className="text-sm text-slate-500">No active KPIs configured.</p>
            <Button variant="outline" className="mt-3" onClick={() => navigate('/kpi/master')}>
              Manage KPIs
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ dept, kpis: deptKpis }) => {
            const deptEntries = deptKpis.map((k) => ({ kpi: k, entry: entryMap[k.id] }));
            const redCount = deptEntries.filter((d) => d.entry?.computed_status === 'red').length;
            const amberCount = deptEntries.filter((d) => d.entry?.computed_status === 'amber').length;
            const greenCount = deptEntries.filter((d) => d.entry?.computed_status === 'green').length;
            const missingCount = deptEntries.filter((d) => d.kpi.kpi_type === 'numeric' && !d.entry).length;

            return (
              <Card key={dept.id} className="overflow-hidden">
                {/* Department header */}
                <div className="border-l-4 border-blue-500 pl-3 pr-4 py-3 flex items-center justify-between bg-white">
                  <h2 className="text-base font-semibold text-slate-800">{dept.name}</h2>
                  <div className="flex items-center gap-2 text-xs">
                    {redCount > 0 && <span className="text-red-600">🔴 {redCount}</span>}
                    {amberCount > 0 && <span className="text-amber-600">🟡 {amberCount}</span>}
                    {greenCount > 0 && <span className="text-emerald-600">🟢 {greenCount}</span>}
                    {missingCount > 0 && <span className="text-slate-400">⬜ {missingCount}</span>}
                  </div>
                </div>

                {/* KPI rows */}
                <div className="divide-y divide-slate-100">
                  {deptKpis.map((kpi) => {
                    const entry = entryMap[kpi.id];
                    const status = entry?.computed_status as RagStatus | null;
                    const isProjectTracker = kpi.kpi_type === 'project_tracker';
                    const isDescriptive = kpi.kpi_type === 'descriptive';
                    const items = piByKpi[kpi.id] || [];
                    const activeItems = items.filter((i) => i.status === 'active').length;
                    const completedItems = items.filter((i) => i.status === 'completed').length;
                    const hasNoAction = status === 'red' && entry && !taskEntryIds.has(entry.id);
                    const isExpanded = expandedRow === kpi.id;

                    const rowBg = status ? ragRowClass[status] : (isProjectTracker || isDescriptive ? '' : 'bg-slate-50');

                    return (
                      <div key={kpi.id}>
                        <div
                          className={cn(
                            'flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-slate-50/50 transition-colors min-h-[44px]',
                            rowBg,
                          )}
                          onClick={() => {
                            if (isMobile) {
                              setDetailKpi({ kpi, entry });
                            } else {
                              setExpandedRow(isExpanded ? null : kpi.id);
                            }
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 truncate">{kpi.name}</p>
                          </div>
                          {isProjectTracker ? (
                            <span className="text-xs text-slate-500 whitespace-nowrap">
                              {activeItems} Active / {completedItems} Completed
                            </span>
                          ) : isDescriptive ? (
                            <span className="text-xs text-slate-500 truncate max-w-[120px]">
                              {entry?.text_value ? entry.text_value.slice(0, 50) : '—'}
                            </span>
                          ) : (
                            <>
                              <span className="text-xs text-slate-400 hidden sm:inline">
                                T: {kpi.target_value ?? '—'}
                              </span>
                              <span className="text-sm font-semibold text-slate-700 w-16 text-right">
                                {entry?.actual_value ?? '—'}
                              </span>
                              {status ? (
                                <Badge className={cn('text-xs rounded-full px-2.5 py-0.5 font-medium', ragBadgeClass[status])}>
                                  {status.charAt(0).toUpperCase() + status.slice(1)}
                                </Badge>
                              ) : (
                                <Badge className="text-xs rounded-full px-2.5 py-0.5 font-medium bg-slate-100 text-slate-400 border border-slate-200">
                                  Missing
                                </Badge>
                              )}
                            </>
                          )}
                          {hasNoAction && (
                            <span title="No action assigned">
                              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                            </span>
                          )}
                          <ChevronRight className={cn('h-4 w-4 text-slate-300 shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                        </div>
                        {/* Inline expand on desktop */}
                        {!isMobile && isExpanded && entry && (
                          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-sm text-slate-600">
                            <p><span className="font-medium">Remarks:</span> {entry.remarks || 'None'}</p>
                            <p className="text-xs text-slate-400 mt-1">
                              Submitted: {format(new Date(entry.submitted_at), 'dd MMM yyyy HH:mm')}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
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
                <span className="text-slate-500">Actual</span>
                <span className="font-semibold">{detailKpi.entry.actual_value ?? detailKpi.entry.text_value ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target</span>
                <span>{detailKpi.kpi.target_value ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                {detailKpi.entry.computed_status ? (
                  <Badge className={cn('text-xs', ragBadgeClass[detailKpi.entry.computed_status as RagStatus])}>
                    {detailKpi.entry.computed_status}
                  </Badge>
                ) : <span>—</span>}
              </div>
              <div>
                <span className="text-slate-500">Remarks</span>
                <p className="mt-1 text-slate-700">{detailKpi.entry.remarks || 'None'}</p>
              </div>
            </div>
          ) : (
            <p className="py-4 text-sm text-slate-400">No entry for this date.</p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatTile({
  label, value, accent, icon, onClick, subtitle,
}: {
  label: string;
  value: number | string;
  accent: string;
  icon: React.ReactNode;
  onClick: () => void;
  subtitle?: string;
}) {
  return (
    <Card
      className={cn('cursor-pointer hover:shadow-md transition-shadow border-l-4', accent)}
      onClick={onClick}
    >
      <CardContent className="p-3 md:p-4 flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="min-w-0">
          <p className="text-2xl md:text-3xl font-bold text-slate-800">{value}</p>
          <p className="text-xs md:text-sm text-slate-500">{label}</p>
          {subtitle && <p className="text-xs text-slate-400 truncate mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
