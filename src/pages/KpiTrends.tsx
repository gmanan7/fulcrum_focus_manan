import { useState, useMemo, useEffect } from 'react';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, ChevronRight, ChevronDown, FileWarning, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { filterKpisForShopFloor, filterDepartmentsForUser, calculateEntryGaps } from '@/lib/shopFloorTrends';
import { type Period, PERIODS, getDateRange, RAG_DOT_COLORS, calculateYMax } from '@/lib/kpiChartUtils';
import { formatIndianNumber } from '@/lib/formatNumber';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts';

function ragBadgeStyle(status: string): React.CSSProperties {
  return {
    background: `var(--rag-${status}-badge-bg)`,
    color: `var(--rag-${status}-badge-text)`,
    border: `1px solid var(--rag-${status}-badge-border)`,
  };
}

const itemStatusStyle: Record<string, React.CSSProperties> = {
  active: { background: 'var(--rag-green-badge-bg)', color: 'var(--rag-green-badge-text)', border: '1px solid var(--rag-green-badge-border)' },
  on_hold: { background: 'var(--rag-amber-badge-bg)', color: 'var(--rag-amber-badge-text)', border: '1px solid var(--rag-amber-badge-border)' },
  completed: { background: 'var(--rag-green-badge-bg)', color: 'var(--rag-green-badge-text)', border: '1px solid var(--rag-green-badge-border)' },
  dropped: { background: 'var(--rag-missing-bg)', color: 'var(--rag-missing-text)', border: '1px solid var(--border-card)' },
};

export default function KpiTrends() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const isShopFloorOnly = roles.length === 1 && roles[0] === 'shop_floor';
  const [period, setPeriod] = useState<Period>('this_month');
  const [customFrom, setCustomFrom] = useState<Date>();
  const [customTo, setCustomTo] = useState<Date>();
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const [rangeFrom, rangeTo] = getDateRange(period, customFrom, customTo);

  // User departments (for shop_floor filtering)
  const { data: userDepartmentIds } = useQuery({
    queryKey: ['user-departments', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from('user_departments').select('department_id').eq('user_id', user.id);
      return (data || []).map((d) => d.department_id);
    },
    enabled: !!user && isShopFloorOnly,
  });

  // All departments
  const { data: departments } = useQuery({
    queryKey: ['trends-all-depts'],
    queryFn: async () => {
      const { data } = await supabase.from('department').select('*').eq('is_active', true).order('display_order');
      return data || [];
    },
  });

  // All active KPIs
  const { data: allKpis } = useQuery({
    queryKey: ['trends-all-kpis'],
    queryFn: async () => {
      const { data } = await supabase.from('kpi_master').select('*').eq('is_active', true).order('display_order');
      return data || [];
    },
  });

  // All entries for period
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['kpi-trends-entries', format(rangeFrom, 'yyyy-MM-dd'), format(rangeTo, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data } = await supabase
        .from('kpi_entries')
        .select('*, submitter:profiles!kpi_entries_submitted_by_fkey(full_name)')
        .gte('reporting_date', format(rangeFrom, 'yyyy-MM-dd'))
        .lte('reporting_date', format(rangeTo, 'yyyy-MM-dd'))
        .order('reporting_date');
      return data || [];
    },
  });

  // Project tracker items + stage updates for project_tracker KPIs
  const { data: projectItems } = useQuery({
    queryKey: ['trends-all-project-items'],
    queryFn: async () => {
      const { data } = await supabase.from('project_tracker_items').select('*').order('display_order');
      return data || [];
    },
  });

  const { data: stageUpdates } = useQuery({
    queryKey: ['trends-all-stage-updates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('project_item_stage_updates')
        .select('*, updater:profiles!project_item_stage_updates_updated_by_fkey(full_name)')
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  // Default: all depts selected; mobile: all collapsed
  useEffect(() => {
    if (departments?.length && selectedDepts.length === 0) {
      if (isShopFloorOnly && userDepartmentIds?.length) {
        setSelectedDepts(userDepartmentIds);
      } else if (!isShopFloorOnly) {
        setSelectedDepts(departments.map((d) => d.id));
      }
    }
  }, [departments, userDepartmentIds, isShopFloorOnly]);

  useEffect(() => {
    if (isMobile && departments?.length) {
      setCollapsedSections(new Set(departments.map((d) => d.id)));
    }
  }, [isMobile, departments]);

  // Group data — shop_floor only sees their departments + numeric KPIs
  const grouped = useMemo(() => {
    if (!departments || !allKpis) return [];
    let filteredDepts = departments.filter((d) => selectedDepts.includes(d.id));
    if (isShopFloorOnly && userDepartmentIds) {
      filteredDepts = filterDepartmentsForUser(filteredDepts, userDepartmentIds);
    }
    return filteredDepts
      .map((dept) => {
        let deptKpis = allKpis.filter((k) => k.department_id === dept.id);
        if (isShopFloorOnly) {
          deptKpis = filterKpisForShopFloor(deptKpis);
        }
        return { dept, kpis: deptKpis };
      })
      .filter((g) => g.kpis.length > 0);
  }, [departments, allKpis, selectedDepts, isShopFloorOnly, userDepartmentIds]);

  const entriesByKpi = useMemo(() => {
    const m: Record<string, any[]> = {};
    entries?.forEach((e) => {
      if (!m[e.kpi_id]) m[e.kpi_id] = [];
      m[e.kpi_id].push(e);
    });
    return m;
  }, [entries]);

  const itemsByKpi = useMemo(() => {
    const m: Record<string, any[]> = {};
    projectItems?.forEach((p) => {
      if (!m[p.kpi_id]) m[p.kpi_id] = [];
      m[p.kpi_id].push(p);
    });
    return m;
  }, [projectItems]);

  const updatesMap = useMemo(() => {
    const m: Record<string, any[]> = {};
    stageUpdates?.forEach((u) => {
      if (!m[u.item_id]) m[u.item_id] = [];
      m[u.item_id].push(u);
    });
    return m;
  }, [stageUpdates]);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setCollapsedSections(new Set());
  const collapseAll = () => setCollapsedSections(new Set(grouped.map((g) => g.dept.id)));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>KPI Trends</h1>
      {isShopFloorOnly && (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Your department's KPI trends</p>
      )}

      {/* Filter bar */}
      <div className="space-y-3">
        {/* Period buttons */}
        <div className="flex gap-2 flex-wrap">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? 'default' : 'outline'}
              onClick={() => setPeriod(p.value)}
              className="h-8 text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="flex gap-3 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 h-9">
                  <CalendarIcon className="h-4 w-4" />
                  {customFrom ? format(customFrom, 'dd MMM yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customFrom} onSelect={(d) => d && setCustomFrom(d)} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 h-9">
                  <CalendarIcon className="h-4 w-4" />
                  {customTo ? format(customTo, 'dd MMM yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customTo} onSelect={(d) => d && setCustomTo(d)} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{grouped.length} department{grouped.length !== 1 ? 's' : ''} shown</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" style={{ color: 'var(--text-muted)' }} onClick={expandAll}>
              <ChevronsUpDown className="h-3 w-3 mr-1" /> Expand All
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" style={{ color: 'var(--text-muted)' }} onClick={collapseAll}>
              <ChevronsDownUp className="h-3 w-3 mr-1" /> Collapse All
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {entriesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="themed-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-[180px] w-full" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card className="themed-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
          <CardContent className="p-8 text-center">
            <FileWarning className="mx-auto h-10 w-10 mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No active KPIs found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ dept, kpis }) => {
            const numericKpis = kpis.filter((k) => k.kpi_type === 'numeric');
            const projectKpis = kpis.filter((k) => k.kpi_type === 'project_tracker');
            const descriptiveKpis = kpis.filter((k) => k.kpi_type === 'descriptive');
            const isCollapsed = collapsedSections.has(dept.id);

            return (
              <div key={dept.id}>
                {/* Department header */}
                <button
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors"
                  style={{ borderLeft: '4px solid var(--color-primary)', background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}
                  onClick={() => toggleSection(dept.id)}
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{dept.name}</h2>
                    <Badge variant="secondary" className="text-[10px]">{numericKpis.length + projectKpis.length + descriptiveKpis.length} KPIs</Badge>
                  </div>
                  {isCollapsed ? <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />}
                </button>

                {!isCollapsed && (
                  <div className="mt-3 space-y-4">
                    {/* Numeric KPI Chart Grid */}
                {numericKpis.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {numericKpis.map((kpi) => (
                          <KpiChartCard key={kpi.id} kpi={kpi} entries={entriesByKpi[kpi.id] || []} isShopFloor={isShopFloorOnly} rangeFrom={rangeFrom} rangeTo={rangeTo} onNavigateToEntry={(date) => navigate(`/kpi/entry?date=${date}`)} />
                        ))}
                      </div>
                    )}

                    {/* Project Tracker section */}
                    {projectKpis.length > 0 && (
                      <ProjectTrackerSection dept={dept} kpis={projectKpis} itemsByKpi={itemsByKpi} updatesMap={updatesMap} />
                    )}

                    {/* Descriptive KPIs section */}
                    {descriptiveKpis.length > 0 && (
                      <DescriptiveSection dept={dept} kpis={descriptiveKpis} entriesByKpi={entriesByKpi} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── KPI Chart Card ── */
function KpiChartCard({ kpi, entries, isShopFloor, rangeFrom, rangeTo, onNavigateToEntry }: {
  kpi: any; entries: any[]; isShopFloor?: boolean; rangeFrom?: Date; rangeTo?: Date;
  onNavigateToEntry?: (date: string) => void;
}) {
  const gapInfo = useMemo(() => {
    if (!isShopFloor || !rangeFrom || !rangeTo) return null;
    const enteredDates = entries.map((e) => e.reporting_date);
    return calculateEntryGaps(rangeFrom, rangeTo, enteredDates);
  }, [isShopFloor, rangeFrom, rangeTo, entries]);

  const chartData = entries.map((e) => ({
    date: format(new Date(e.reporting_date), 'dd/MM'),
    actual: e.actual_value,
    status: e.computed_status,
    remarks: e.remarks,
    submitter: (e as any).submitter?.full_name,
    fullDate: format(new Date(e.reporting_date), 'dd MMM yyyy'),
  }));

  const latest = entries[entries.length - 1];
  const latestStatus = latest?.computed_status;

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null) return null;
    const color = RAG_DOT_COLORS[payload.status] || 'var(--chart-line)';
    return <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1.5} />;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg shadow-md p-3 text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{d.fullDate}</p>
        <p style={{ color: 'var(--text-secondary)' }}>Actual: <span className="font-semibold">{formatIndianNumber(d.actual)}</span></p>
        {d.status && (
          <p style={{ color: 'var(--text-secondary)' }}>Status: <Badge className="text-xs ml-1" style={ragBadgeStyle(d.status)}>{d.status}</Badge></p>
        )}
        {d.remarks && <p className="mt-1" style={{ color: 'var(--text-muted)' }}>{d.remarks}</p>}
        {d.submitter && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>By: {d.submitter}</p>}
      </div>
    );
  };

  return (
    <Card className="themed-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{kpi.name}</p>
            {kpi.unit && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{kpi.unit}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {latest && <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatIndianNumber(latest.actual_value)}</span>}
            {latestStatus ? (
              <Badge className="text-[10px] rounded-full px-2 py-0.5" style={ragBadgeStyle(latestStatus)}>{latestStatus}</Badge>
            ) : (
              <Badge className="text-[10px] rounded-full px-2 py-0.5" style={{ background: 'var(--rag-missing-bg)', color: 'var(--rag-missing-text)' }}>No data</Badge>
            )}
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 ? (
          <div style={{ background: 'var(--chart-bg)', borderRadius: 8 }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatIndianNumber(typeof v === 'number' ? v : Number(v))} domain={[0, calculateYMax(chartData.map(d => ({ value: d.actual })), kpi.target_value)]} padding={{ top: 10, bottom: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                {kpi.green_threshold != null && (
                  <ReferenceLine y={kpi.green_threshold} stroke="var(--chart-green-ref)" strokeDasharray="4 2" label={{ value: 'Green', position: 'right', fontSize: 9, fill: 'var(--chart-green-ref)' }} />
                )}
                {kpi.amber_threshold != null && (
                  <ReferenceLine y={kpi.amber_threshold} stroke="var(--chart-amber-ref)" strokeDasharray="4 2" label={{ value: 'Amber', position: 'right', fontSize: 9, fill: 'var(--chart-amber-ref)' }} />
                )}
                {kpi.target_value != null && (
                  <ReferenceLine y={kpi.target_value} stroke="var(--chart-target-ref)" strokeDasharray="2 2" label={{ value: 'Target', position: 'right', fontSize: 9, fill: 'var(--chart-target-ref)' }} />
                )}
                <Line type="monotone" dataKey="actual" stroke="var(--chart-line)" strokeWidth={2} connectNulls={false} dot={<CustomDot />} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[200px] gap-2" style={{ background: 'var(--rag-missing-bg)', borderRadius: 8 }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No entries for this period</p>
            <a href={`/kpi/entry?dept=${kpi.department_id}`} className="text-xs font-medium hover:underline" style={{ color: 'var(--color-primary)' }}>Enter KPIs →</a>
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{entries.length} entries</p>
          {gapInfo && gapInfo.missingDates.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{gapInfo.summary}</span>
              <button
                onClick={() => onNavigateToEntry?.(gapInfo.missingDates[0])}
                className="text-xs font-medium hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Enter missing data →
              </button>
            </div>
          )}
          {gapInfo && gapInfo.missingDates.length === 0 && (
            <span className="text-xs" style={{ color: 'var(--rag-green-badge-text)' }}>✓ All days entered</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Project Tracker Section ── */
function ProjectTrackerSection({ dept, kpis, itemsByKpi, updatesMap }: {
  dept: any; kpis: any[]; itemsByKpi: Record<string, any[]>; updatesMap: Record<string, any[]>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{dept.name} — Projects & Trackers</span>
          {open ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3">
        {kpis.map((kpi) => {
          const items = itemsByKpi[kpi.id] || [];
          const grouped: Record<string, any[]> = { active: [], on_hold: [], completed: [], dropped: [] };
          items.forEach((item) => { if (grouped[item.status]) grouped[item.status].push(item); });
          return (
            <div key={kpi.id} className="space-y-2">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{kpi.name}</p>
              {Object.entries(grouped).filter(([, arr]) => arr.length > 0).map(([st, arr]) => (
                <Collapsible key={st} defaultOpen={st === 'active' || st === 'on_hold'}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between text-sm h-8" style={{ color: 'var(--text-secondary)' }}>
                      {st.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} ({arr.length})
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2 mt-1">
                    {arr.map((item) => {
                      const updates = updatesMap[item.id] || [];
                      const latest = updates[0];
                      return (
                        <Card key={item.id} className="themed-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</span>
                              <Badge className="text-xs rounded-full px-2.5 py-0.5" style={itemStatusStyle[item.status]}>{item.status.replace('_', ' ')}</Badge>
                            </div>
                            {latest && (
                              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                Stage: {latest.stage_name} — {latest.update_note || ''}{' '}
                                <span style={{ color: 'var(--text-muted)' }}>({format(new Date(latest.created_at), 'dd MMM')})</span>
                              </p>
                            )}
                            {updates.length > 1 && (
                              <Collapsible>
                                <CollapsibleTrigger asChild>
                                  <Button variant="link" size="sm" className="px-0 h-auto text-xs">Show all updates</Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 space-y-1">
                                  {updates.slice(1).map((u) => (
                                    <p key={u.id} className="text-xs" style={{ color: 'var(--text-muted)' }}>
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
              ))}
              {items.length === 0 && <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>No items.</p>}
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Descriptive Section ── */
function DescriptiveSection({ dept, kpis, entriesByKpi }: {
  dept: any; kpis: any[]; entriesByKpi: Record<string, any[]>;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{dept.name} — Descriptive KPIs</span>
          {open ? <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="h-4 w-4" style={{ color: 'var(--text-muted)' }} />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-3">
        {kpis.map((kpi) => {
          const kpiEntries = (entriesByKpi[kpi.id] || []).slice(-5);
          return (
            <Card key={kpi.id} className="themed-card" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
              <CardContent className="p-3">
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{kpi.name}</p>
                {kpiEntries.length > 0 ? (
                  <div className="space-y-1.5">
                    {kpiEntries.map((e) => (
                      <div key={e.id} className="text-xs" style={{ borderLeft: '2px solid var(--color-primary)', paddingLeft: 8 }}>
                        <span style={{ color: 'var(--text-muted)' }}>{format(new Date(e.reporting_date), 'dd MMM')}</span>
                        <span className="ml-2" style={{ color: 'var(--text-secondary)' }}>{e.text_value || '—'}</span>
                        {(e as any).submitter && <span className="ml-2" style={{ color: 'var(--text-muted)' }}>— {(e as any).submitter.full_name}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No entries.</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
