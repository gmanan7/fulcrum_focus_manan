import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks, startOfYear } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, ChevronDown, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Dot,
} from 'recharts';

type Period = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_year' | 'custom';

const ragDotColor: Record<string, string> = { red: '#ef4444', amber: '#f59e0b', green: '#10b981' };

const itemStatusBadge: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700 border border-blue-300',
  on_hold: 'bg-amber-100 text-amber-700 border border-amber-300',
  completed: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
  dropped: 'bg-slate-100 text-slate-500 border border-slate-300',
};

function getDateRange(period: Period, customFrom?: Date, customTo?: Date): [Date, Date] {
  const now = new Date();
  switch (period) {
    case 'this_week': return [startOfWeek(now, { weekStartsOn: 1 }), now];
    case 'last_week': { const lw = subWeeks(now, 1); return [startOfWeek(lw, { weekStartsOn: 1 }), endOfWeek(lw, { weekStartsOn: 1 })]; }
    case 'this_month': return [startOfMonth(now), now];
    case 'last_month': { const lm = subMonths(now, 1); return [startOfMonth(lm), endOfMonth(lm)]; }
    case 'this_year': return [startOfYear(now), now];
    case 'custom': return [customFrom || subDays(now, 30), customTo || now];
    default: return [startOfMonth(now), now];
  }
}

export default function KpiTrends() {
  const isMobile = useIsMobile();
  const [deptId, setDeptId] = useState<string>('');
  const [kpiId, setKpiId] = useState<string>('');
  const [period, setPeriod] = useState<Period>('this_month');
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();

  const { data: departments } = useQuery({
    queryKey: ['trends-depts'],
    queryFn: async () => {
      const { data } = await supabase.from('department').select('*').eq('is_active', true).order('display_order');
      return data || [];
    },
  });

  const { data: kpis } = useQuery({
    queryKey: ['trends-kpis', deptId],
    queryFn: async () => {
      if (!deptId) return [];
      const { data } = await supabase
        .from('kpi_master')
        .select('*')
        .eq('department_id', deptId)
        .eq('is_active', true)
        .order('display_order');
      return data || [];
    },
    enabled: !!deptId,
  });

  // Auto-select first dept, first kpi
  useMemo(() => {
    if (departments?.length && !deptId) setDeptId(departments[0].id);
  }, [departments]);
  useMemo(() => {
    if (kpis?.length && (!kpiId || !kpis.find((k) => k.id === kpiId))) setKpiId(kpis[0].id);
  }, [kpis]);

  const selectedKpi = kpis?.find((k) => k.id === kpiId);
  const isProjectTracker = selectedKpi?.kpi_type === 'project_tracker';

  const [rangeFrom, rangeTo] = getDateRange(period, customFrom, customTo);

  // Fetch entries for line chart
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['trends-entries', kpiId, format(rangeFrom, 'yyyy-MM-dd'), format(rangeTo, 'yyyy-MM-dd')],
    queryFn: async () => {
      if (!kpiId || isProjectTracker) return [];
      const { data } = await supabase
        .from('kpi_entries')
        .select('*, submitter:profiles!kpi_entries_submitted_by_fkey(full_name)')
        .eq('kpi_id', kpiId)
        .gte('reporting_date', format(rangeFrom, 'yyyy-MM-dd'))
        .lte('reporting_date', format(rangeTo, 'yyyy-MM-dd'))
        .order('reporting_date');
      return data || [];
    },
    enabled: !!kpiId && !isProjectTracker,
  });

  // Fetch project tracker items
  const { data: projectItems } = useQuery({
    queryKey: ['trends-project-items', kpiId],
    queryFn: async () => {
      if (!kpiId) return [];
      const { data } = await supabase
        .from('project_tracker_items')
        .select('*')
        .eq('kpi_id', kpiId)
        .order('display_order');
      return data || [];
    },
    enabled: !!kpiId && isProjectTracker,
  });

  const { data: stageUpdates } = useQuery({
    queryKey: ['trends-stage-updates', kpiId],
    queryFn: async () => {
      if (!kpiId || !projectItems?.length) return [];
      const ids = projectItems.map((i) => i.id);
      const { data } = await supabase
        .from('project_item_stage_updates')
        .select('*, updater:profiles!project_item_stage_updates_updated_by_fkey(full_name)')
        .in('item_id', ids)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!projectItems?.length,
  });

  const chartData = useMemo(() => {
    return (entries || []).map((e) => ({
      date: format(new Date(e.reporting_date), 'dd MMM'),
      actual: e.actual_value,
      status: e.computed_status,
      remarks: e.remarks,
      submitter: (e as any).submitter?.full_name,
    }));
  }, [entries]);

  const updatesMap = useMemo(() => {
    const m: Record<string, any[]> = {};
    stageUpdates?.forEach((u) => {
      if (!m[u.item_id]) m[u.item_id] = [];
      m[u.item_id].push(u);
    });
    return m;
  }, [stageUpdates]);

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const color = ragDotColor[payload.status] || '#3b82f6';
    return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2} />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-slate-200 rounded-lg shadow-md p-3 text-sm">
        <p className="font-medium">{d.date}</p>
        <p>Actual: <span className="font-semibold">{d.actual}</span></p>
        <p>Status: <Badge className={cn('text-xs', d.status && {
          red: 'bg-red-100 text-red-700', amber: 'bg-amber-100 text-amber-700', green: 'bg-emerald-100 text-emerald-700',
        }[d.status])}>{d.status || '—'}</Badge></p>
        {d.remarks && <p className="mt-1 text-slate-500">{d.remarks}</p>}
        {d.submitter && <p className="text-xs text-slate-400 mt-1">By: {d.submitter}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">KPI Trends</h1>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={deptId} onValueChange={(v) => { setDeptId(v); setKpiId(''); }}>
          <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={kpiId} onValueChange={setKpiId}>
          <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Select KPI" /></SelectTrigger>
          <SelectContent>
            {kpis?.map((k) => <SelectItem key={k.id} value={k.id}>{k.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {!isProjectTracker && (
          <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="last_week">Last Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {period === 'custom' && !isProjectTracker && (
        <div className="flex gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {customFrom ? format(customFrom, 'dd MMM yyyy') : 'From'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customFrom} onSelect={(d) => d && setCustomFrom(d)} /></PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {customTo ? format(customTo, 'dd MMM yyyy') : 'To'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customTo} onSelect={(d) => d && setCustomTo(d)} /></PopoverContent>
          </Popover>
        </div>
      )}

      {!kpiId ? (
        <Card><CardContent className="p-8 text-center text-sm text-slate-400">
          <FileWarning className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          Select a department and KPI to view trends.
        </CardContent></Card>
      ) : isProjectTracker ? (
        /* Project Tracker View */
        <div className="space-y-3">
          {['active', 'on_hold', 'completed', 'dropped'].map((st) => {
            const items = projectItems?.filter((i) => i.status === st) || [];
            if (!items.length) return null;
            return (
              <Collapsible key={st} defaultOpen={st === 'active' || st === 'on_hold'}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between text-sm font-semibold text-slate-700">
                    {st.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ({items.length})
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-1">
                  {items.map((item) => {
                    const updates = updatesMap[item.id] || [];
                    const latest = updates[0];
                    return (
                      <Card key={item.id}>
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-slate-700">{item.title}</span>
                            <Badge className={cn('text-xs rounded-full px-2.5 py-0.5', itemStatusBadge[item.status])}>
                              {item.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          {latest && (
                            <p className="text-xs text-slate-500 mt-1">
                              Stage: {latest.stage_name} — {latest.update_note || ''}{' '}
                              <span className="text-slate-400">({format(new Date(latest.created_at), 'dd MMM')})</span>
                            </p>
                          )}
                          {updates.length > 1 && (
                            <Collapsible>
                              <CollapsibleTrigger asChild>
                                <Button variant="link" size="sm" className="px-0 h-auto text-xs">Show all updates</Button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="mt-2 space-y-1">
                                {updates.slice(1).map((u) => (
                                  <p key={u.id} className="text-xs text-slate-400">
                                    {u.stage_name}: {u.update_note || '—'} ({format(new Date(u.created_at), 'dd MMM')})
                                  </p>
                                ))}
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
          {!projectItems?.length && (
            <Card><CardContent className="p-8 text-center text-sm text-slate-400">No project items.</CardContent></Card>
          )}
        </div>
      ) : entriesLoading ? (
        <Card><CardContent className="p-4 space-y-3">
          <Skeleton className="h-[250px] w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent></Card>
      ) : !chartData.length ? (
        <Card><CardContent className="p-8 text-center text-sm text-slate-400">
          <FileWarning className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          No entries for this period.
        </CardContent></Card>
      ) : (
        <>
          {/* Chart */}
          <Card>
            <CardContent className="p-4">
              <div className={cn('w-full', isMobile ? 'overflow-x-auto' : '')}>
                <div style={{ minWidth: isMobile ? Math.max(400, chartData.length * 50) : '100%' }}>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
                      <Tooltip content={<CustomTooltip />} />
                      {selectedKpi?.green_threshold != null && (
                        <ReferenceLine y={selectedKpi.green_threshold} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'Green', position: 'right', fontSize: 10, fill: '#10b981' }} />
                      )}
                      {selectedKpi?.amber_threshold != null && (
                        <ReferenceLine y={selectedKpi.amber_threshold} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Amber', position: 'right', fontSize: 10, fill: '#f59e0b' }} />
                      )}
                      {selectedKpi?.target_value != null && (
                        <ReferenceLine y={selectedKpi.target_value} stroke="#6366f1" strokeDasharray="5 5" label={{ value: 'Target', position: 'right', fontSize: 10, fill: '#6366f1' }} />
                      )}
                      <Line
                        type="monotone"
                        dataKey="actual"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        connectNulls={false}
                        dot={<CustomDot />}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data table */}
          <Card>
            <CardContent className="p-0">
              {isMobile ? (
                <div className="divide-y divide-slate-100">
                  {(entries || []).map((e) => (
                    <div key={e.id} className="p-3 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">{format(new Date(e.reporting_date), 'dd MMM yyyy')}</span>
                        {e.computed_status && (
                          <Badge className={cn('text-xs rounded-full', {
                            red: 'bg-red-100 text-red-700 border border-red-300',
                            amber: 'bg-amber-100 text-amber-700 border border-amber-300',
                            green: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
                          }[e.computed_status as string])}>{e.computed_status}</Badge>
                        )}
                      </div>
                      <p className="text-sm">Actual: <span className="font-semibold">{e.actual_value ?? '—'}</span></p>
                      {e.remarks && <p className="text-xs text-slate-500">{e.remarks}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Actual</th>
                      <th className="text-center px-4 py-2 font-medium text-slate-600">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Remarks</th>
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Submitted By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(entries || []).map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-2 text-slate-700">{format(new Date(e.reporting_date), 'dd MMM yyyy')}</td>
                        <td className="px-4 py-2 text-right font-semibold">{e.actual_value ?? '—'}</td>
                        <td className="px-4 py-2 text-center">
                          {e.computed_status && (
                            <Badge className={cn('text-xs rounded-full', {
                              red: 'bg-red-100 text-red-700 border border-red-300',
                              amber: 'bg-amber-100 text-amber-700 border border-amber-300',
                              green: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
                            }[e.computed_status as string])}>{e.computed_status}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-500 max-w-[200px] truncate">{e.remarks || '—'}</td>
                        <td className="px-4 py-2 text-slate-500">{(e as any).submitter?.full_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
