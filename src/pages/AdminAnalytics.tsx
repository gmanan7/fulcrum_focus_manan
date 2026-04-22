import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, RefreshCw, FileDown, ChevronDown, AlertTriangle, AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow, startOfWeek } from 'date-fns';
import { exportAnalyticsPdf, type AnalyticsPdfPayload } from '@/lib/analyticsPdf';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import { formatIndianNumber } from '@/lib/formatNumber';
import {
  AnalyticsPeriod, ActivityStatus,
  resolvePeriodRange, getActivityStatus, getActivityScore, daysSince,
  calculateComplianceRate, workingDaysElapsed, STATUS_SORT_ORDER,
} from '@/lib/analytics';
import { cn } from '@/lib/utils';

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  this_month: 'This Month',
  last_30: 'Last 30 Days',
  last_7: 'Last 7 Days',
  all_time: 'All Time',
};

const STATUS_BADGE: Record<ActivityStatus, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-success/15 text-success border-success/30' },
  idle: { label: 'Idle', cls: 'bg-warning/15 text-warning border-warning/30' },
  inactive: { label: 'Inactive', cls: 'bg-destructive/15 text-destructive border-destructive/30' },
  never: { label: 'Never Used', cls: 'bg-muted text-muted-foreground border-border' },
};

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: 'red' | 'amber' | 'green' }) {
  const ring =
    accent === 'red' ? 'border-destructive/40'
    : accent === 'amber' ? 'border-warning/40'
    : accent === 'green' ? 'border-success/40'
    : 'border-border';
  return (
    <Card className={cn('border', ring)}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function Section({
  title, children, defaultOpen = true, lastUpdated, onRefresh,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
  lastUpdated?: Date | null; onRefresh?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2 px-4 pt-4">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
            <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
            <CardTitle className="text-base">{title}</CardTitle>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {lastUpdated && <span>Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>}
            {onRefresh && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <CollapsibleContent>
          <CardContent className="pt-4">{children}</CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default function AdminAnalytics() {
  const { hasAnyRole, profile, roles } = useAuth();
  const allowed = hasAnyRole('super_admin', 'factory_manager');
  const [period, setPeriod] = useState<AnalyticsPeriod>('this_month');
  const [exporting, setExporting] = useState(false);
  const [now, setNow] = useState(new Date());
  const range = useMemo(() => resolvePeriodRange(period, now), [period, now]);

  // ---- Single batched fetch ----
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    enabled: allowed,
    queryKey: ['admin-analytics', period],
    queryFn: async () => {
      const startISO = range.start;
      const endISO = range.end;

      const tasksQ = supabase.from('tasks').select(
        'id,title,status,due_date,owner_id,assigned_by,created_by,created_at,completed_at',
      );
      const taskUpdatesQ = supabase.from('task_updates').select(
        'id,task_id,update_type,updated_by,created_at',
      );
      const kpiEntriesQ = supabase.from('kpi_entries').select(
        'id,kpi_id,submitted_by,reporting_date,submitted_at,is_late_entry',
      );
      const kpiMasterQ = supabase
        .from('kpi_master')
        .select('id,department_id,kpi_type,frequency,is_active')
        .eq('is_active', true);
      const profilesQ = supabase.from('profiles').select('id,full_name,is_active');
      const rolesQ = supabase.from('user_roles').select('user_id,role');
      const userDeptsQ = supabase.from('user_departments').select('user_id,department_id');
      const deptQ = supabase.from('department').select('id,name,code,is_active').eq('is_active', true);
      const meetingsQ = supabase
        .from('meetings')
        .select('id,title,scheduled_date,status,created_at')
        .order('scheduled_date', { ascending: false });
      const attendanceQ = supabase.from('meeting_attendance').select('meeting_id,status');
      const discussionQ = supabase.from('meeting_discussion_points').select('meeting_id,notes');
      const decisionsQ = supabase.from('meeting_decisions').select('meeting_id');

      const [tasks, taskUpdates, kpiEntries, kpiMaster, profiles, roles, userDepts, depts, meetings, attendance, discussion, decisions] = await Promise.all([
        tasksQ, taskUpdatesQ, kpiEntriesQ, kpiMasterQ, profilesQ, rolesQ, userDeptsQ, deptQ, meetingsQ, attendanceQ, discussionQ, decisionsQ,
      ]);

      return {
        tasks: tasks.data ?? [],
        taskUpdates: taskUpdates.data ?? [],
        kpiEntries: kpiEntries.data ?? [],
        kpiMaster: kpiMaster.data ?? [],
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
        userDepts: userDepts.data ?? [],
        depts: depts.data ?? [],
        meetings: meetings.data ?? [],
        attendance: attendance.data ?? [],
        discussion: discussion.data ?? [],
        decisions: decisions.data ?? [],
        startISO, endISO,
      };
    },
  });

  if (!allowed) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">You do not have access to this page.</p>
      </div>
    );
  }

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">Platform Analytics</h1>
          <p className="text-sm text-muted-foreground">Usage insights and compliance monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as AnalyticsPeriod)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABELS) as AnalyticsPeriod[]).map((k) => (
                <SelectItem key={k} value={k}>{PERIOD_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setNow(new Date()); refetch(); }}>
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button
            variant="outline" size="sm"
            disabled={!data || exporting}
            onClick={async () => {
              if (!data) return;
              setExporting(true);
              const tId = toast.loading('Generating report...');
              try {
                const payload = buildAnalyticsPdfPayload(
                  data, period, PERIOD_LABELS[period],
                  { name: profile?.full_name ?? '—', role: roles[0] ?? '—' },
                );
                const filename = await exportAnalyticsPdf(payload);
                toast.success(`Downloaded ${filename}`, { id: tId });
              } catch (e: any) {
                toast.error(`Export failed: ${e?.message ?? 'unknown error'}`, { id: tId });
              } finally {
                setExporting(false);
              }
            }}
          >
            <FileDown className="mr-2 h-4 w-4" /> {exporting ? 'Generating…' : 'Export Report'}
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <>
          <PeopleSection data={data} period={period} lastUpdated={lastUpdated} onRefresh={refetch} />
          <KpiComplianceSection data={data} period={period} lastUpdated={lastUpdated} onRefresh={refetch} />
          <MeetingHealthSection data={data} period={period} lastUpdated={lastUpdated} onRefresh={refetch} />
          <TaskAccountabilitySection data={data} period={period} lastUpdated={lastUpdated} onRefresh={refetch} />
        </>
      )}
    </div>
  );
}

/* ============================================================
 *  SECTION 1 — PEOPLE & ENGAGEMENT
 * ============================================================ */
function PeopleSection({ data, period, lastUpdated, onRefresh }: any) {
  const { profiles, roles, userDepts, depts, kpiEntries, taskUpdates, tasks } = data;
  const range = resolvePeriodRange(period);
  const startMs = range.start ? new Date(range.start).getTime() : 0;

  const deptById = new Map<string, any>(depts.map((d: any) => [d.id, d]));
  const userDeptsBy = new Map<string, string[]>();
  userDepts.forEach((ud: any) => {
    const arr = userDeptsBy.get(ud.user_id) ?? [];
    const d = deptById.get(ud.department_id);
    if (d) arr.push(d.code);
    userDeptsBy.set(ud.user_id, arr);
  });
  const roleByUser = new Map<string, string>();
  roles.forEach((r: any) => { if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role); });

  // last activity + period counts per user
  const lastActivity = new Map<string, number>();
  const entryCount = new Map<string, number>();
  const updateCount = new Map<string, number>();
  const taskCreatedCount = new Map<string, number>();

  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const updateLast = (uid: string, iso: string) => {
    const t = new Date(iso).getTime();
    if (!lastActivity.has(uid) || lastActivity.get(uid)! < t) lastActivity.set(uid, t);
  };

  kpiEntries.forEach((e: any) => {
    if (!e.submitted_by) return;
    updateLast(e.submitted_by, e.submitted_at);
    if (new Date(e.submitted_at).getTime() >= startMs) bump(entryCount, e.submitted_by);
  });
  taskUpdates.forEach((u: any) => {
    if (!u.updated_by) return;
    updateLast(u.updated_by, u.created_at);
    if (new Date(u.created_at).getTime() >= startMs) bump(updateCount, u.updated_by);
  });
  tasks.forEach((t: any) => {
    if (t.created_by) {
      updateLast(t.created_by, t.created_at);
      if (new Date(t.created_at).getTime() >= startMs) bump(taskCreatedCount, t.created_by);
    }
    if (t.assigned_by) updateLast(t.assigned_by, t.created_at);
  });

  const now = Date.now();
  const rows = profiles.map((p: any) => {
    const lastMs = lastActivity.get(p.id) ?? null;
    const days = lastMs == null ? null : Math.floor((now - lastMs) / 86400000);
    const score = getActivityScore(entryCount.get(p.id) ?? 0, updateCount.get(p.id) ?? 0, taskCreatedCount.get(p.id) ?? 0);
    return {
      id: p.id,
      name: p.full_name,
      role: roleByUser.get(p.id) ?? '—',
      depts: (userDeptsBy.get(p.id) ?? []).join(', ') || '—',
      lastActivity: lastMs ? new Date(lastMs) : null,
      days,
      score,
      status: getActivityStatus(days),
    };
  });

  const maxScore = rows.reduce((m: number, r: any) => Math.max(m, r.score), 0);
  rows.sort((a: any, b: any) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]);

  const totalUsers = profiles.length;
  const activeWeek = rows.filter((r: any) => r.days !== null && r.days <= 7).length;
  const neverUsed = rows.filter((r: any) => r.status === 'never').length;
  const activeToday = rows.filter((r: any) => r.days !== null && r.days <= 0).length;

  return (
    <Section title="People & Engagement" lastUpdated={lastUpdated} onRefresh={onRefresh}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total registered users" value={formatIndianNumber(totalUsers)} />
        <StatCard label="Active this week" value={formatIndianNumber(activeWeek)} accent="green" />
        <StatCard label="Never used / zero activity" value={formatIndianNumber(neverUsed)} accent={neverUsed > 0 ? 'red' : undefined} />
        <StatCard label="Active today" value={formatIndianNumber(activeToday)} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Departments</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead>Activity Score</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r: any) => {
              const pct = maxScore > 0 ? (r.score / maxScore) * 100 : 0;
              const badge = STATUS_BADGE[r.status as ActivityStatus];
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.role}</TableCell>
                  <TableCell className="text-xs">{r.depts}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.lastActivity ? format(r.lastActivity, 'd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-sm font-semibold">{r.score}</span>
                      <div className="h-1.5 w-24 rounded bg-muted">
                        <div className="h-full rounded bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('border', badge.cls)}>{badge.label}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">No users found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

/* ============================================================
 *  SECTION 2 — KPI ENTRY COMPLIANCE
 * ============================================================ */
function KpiComplianceSection({ data, period, lastUpdated, onRefresh }: any) {
  const { kpiEntries, kpiMaster, depts } = data;
  const range = resolvePeriodRange(period);
  const start = range.start ? new Date(range.start) : new Date(0);
  const end = new Date(range.end);

  const numericKpis = kpiMaster.filter((k: any) => k.kpi_type === 'numeric');
  const kpisByDept = new Map<string, any[]>();
  numericKpis.forEach((k: any) => {
    const arr = kpisByDept.get(k.department_id) ?? [];
    arr.push(k); kpisByDept.set(k.department_id, arr);
  });

  // Working days in period (capped to today)
  const today = new Date();
  const periodEnd = end > today ? today : end;
  const wd = workingDaysElapsed(start, periodEnd);

  const inPeriod = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  const kpiToDept = new Map<string, string>(numericKpis.map((k: any) => [k.id, k.department_id]));

  const entriesByDept = new Map<string, any[]>();
  kpiEntries.forEach((e: any) => {
    if (!inPeriod(e.submitted_at)) return;
    const did = kpiToDept.get(e.kpi_id);
    if (!did) return;
    const arr = entriesByDept.get(did) ?? [];
    arr.push(e); entriesByDept.set(did, arr);
  });

  const deptRows = depts.map((d: any) => {
    const kpis = kpisByDept.get(d.id) ?? [];
    const expected = kpis.length * wd;
    const entries = entriesByDept.get(d.id) ?? [];
    const actual = entries.length;
    const late = entries.filter((e: any) => e.is_late_entry).length;
    const lastEntryISO = entries.reduce((m: string | null, e: any) => (!m || e.submitted_at > m ? e.submitted_at : m), null as string | null);
    const compliance = calculateComplianceRate(actual, expected);
    return { id: d.id, name: d.name, code: d.code, expected, actual, compliance, late, lastEntryISO };
  });

  deptRows.sort((a: any, b: any) => a.compliance - b.compliance);

  const totalExpected = deptRows.reduce((s: number, r: any) => s + r.expected, 0);
  const totalActual = deptRows.reduce((s: number, r: any) => s + r.actual, 0);
  const factoryRate = calculateComplianceRate(totalActual, totalExpected);
  const at100 = deptRows.filter((r: any) => r.compliance === 100 && r.expected > 0).length;
  const below50 = deptRows.filter((r: any) => r.compliance < 50 && r.expected > 0).length;
  const lateThisMonth = deptRows.reduce((s: number, r: any) => s + r.late, 0);

  const barColor = (pct: number) => pct >= 90 ? 'bg-success' : pct >= 70 ? 'bg-warning' : 'bg-destructive';

  // weekly chart per department
  const chartData = (() => {
    const weeks = new Map<string, any>();
    kpiEntries.forEach((e: any) => {
      if (!inPeriod(e.submitted_at)) return;
      const did = kpiToDept.get(e.kpi_id);
      if (!did) return;
      const wk = format(startOfWeek(new Date(e.submitted_at), { weekStartsOn: 1 }), 'd MMM');
      if (!weeks.has(wk)) weeks.set(wk, { week: wk });
      const row = weeks.get(wk);
      const dept = depts.find((d: any) => d.id === did);
      if (dept) row[dept.code] = (row[dept.code] ?? 0) + 1;
    });
    return Array.from(weeks.values());
  })();

  return (
    <Section title="KPI Entry Compliance" lastUpdated={lastUpdated} onRefresh={onRefresh}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Factory entry rate" value={`${factoryRate}%`} accent={factoryRate < 50 ? 'red' : factoryRate >= 90 ? 'green' : 'amber'} />
        <StatCard label="Departments at 100%" value={formatIndianNumber(at100)} accent={at100 > 0 ? 'green' : undefined} />
        <StatCard label="Departments below 50%" value={formatIndianNumber(below50)} accent={below50 > 0 ? 'red' : undefined} />
        <StatCard label="Late entries this period" value={formatIndianNumber(lateThisMonth)} accent={lateThisMonth > 0 ? 'amber' : undefined} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Department</TableHead>
              <TableHead>Expected</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead>Compliance</TableHead>
              <TableHead>Late</TableHead>
              <TableHead>Last Entry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deptRows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{formatIndianNumber(r.expected)}</TableCell>
                <TableCell>{formatIndianNumber(r.actual)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="w-10 text-sm font-semibold">{r.compliance}%</span>
                    <div className="h-1.5 w-24 rounded bg-muted">
                      <div className={cn('h-full rounded', barColor(r.compliance))} style={{ width: `${r.compliance}%` }} />
                    </div>
                  </div>
                </TableCell>
                <TableCell>{formatIndianNumber(r.late)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.lastEntryISO ? format(new Date(r.lastEntryISO), 'd MMM yyyy') : '—'}
                </TableCell>
              </TableRow>
            ))}
            {deptRows.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No departments</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {chartData.length > 0 && (
        <div className="mt-4 h-72" data-export-chart="compliance-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {depts.map((d: any, i: number) => (
                <Bar key={d.id} dataKey={d.code} stackId="a" fill={`hsl(${(i * 47) % 360} 60% 55%)`} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  );
}

/* ============================================================
 *  SECTION 3 — MEETING HEALTH
 * ============================================================ */
function MeetingHealthSection({ data, period, lastUpdated, onRefresh }: any) {
  const { meetings, attendance, discussion, decisions, tasks } = data;
  const range = resolvePeriodRange(period);
  const start = range.start ? new Date(range.start) : new Date(0);
  const end = new Date(range.end);

  const inPeriod = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  const meetingsInPeriod = meetings.filter((m: any) => inPeriod(m.scheduled_date));
  const held = meetingsInPeriod.filter((m: any) => m.status === 'completed').length;
  const completionRate = meetingsInPeriod.length > 0 ? Math.round((held / meetingsInPeriod.length) * 100) : 0;

  const weekSpan = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 86400000)));
  const avgPerWeek = (meetingsInPeriod.length / weekSpan).toFixed(1);

  // tasks created from meetings
  const tasksByMeeting = new Map<string, number>();
  tasks.forEach((t: any) => {
    if (t.origin_meeting_id) tasksByMeeting.set(t.origin_meeting_id, (tasksByMeeting.get(t.origin_meeting_id) ?? 0) + 1);
  });
  const notesByMeeting = new Map<string, boolean>();
  discussion.forEach((d: any) => {
    if (d.notes && d.notes.trim()) notesByMeeting.set(d.meeting_id, true);
  });
  const decisionsByMeeting = new Map<string, number>();
  decisions.forEach((d: any) => decisionsByMeeting.set(d.meeting_id, (decisionsByMeeting.get(d.meeting_id) ?? 0) + 1));
  const attendanceByMeeting = new Map<string, { present: number; total: number }>();
  attendance.forEach((a: any) => {
    const cur = attendanceByMeeting.get(a.meeting_id) ?? { present: 0, total: 0 };
    cur.total += 1;
    if (a.status === 'present') cur.present += 1;
    attendanceByMeeting.set(a.meeting_id, cur);
  });

  const zeroTaskMeetings = meetingsInPeriod.filter((m: any) => m.status === 'completed' && !tasksByMeeting.get(m.id)).length;

  // weekly frequency
  const weekly = new Map<string, number>();
  meetingsInPeriod.forEach((m: any) => {
    const wk = format(startOfWeek(new Date(m.scheduled_date), { weekStartsOn: 1 }), 'd MMM');
    weekly.set(wk, (weekly.get(wk) ?? 0) + 1);
  });
  const freqData = Array.from(weekly.entries()).map(([week, count]) => ({ week, count }));

  const last20 = [...meetings].slice(0, 20);

  return (
    <Section title="Meeting Health" lastUpdated={lastUpdated} onRefresh={onRefresh}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Meetings in period" value={formatIndianNumber(meetingsInPeriod.length)} />
        <StatCard label="Completion rate" value={`${completionRate}%`} accent={completionRate >= 80 ? 'green' : completionRate < 50 ? 'red' : 'amber'} />
        <StatCard label="Avg meetings / week" value={avgPerWeek} />
        <StatCard label="Zero-task meetings" value={formatIndianNumber(zeroTaskMeetings)} accent={zeroTaskMeetings > 0 ? 'amber' : undefined} />
      </div>

      {freqData.length > 0 && (
        <div className="mt-4 h-56" data-export-chart="meeting-frequency-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={freqData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Tasks</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead>Decisions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {last20.map((m: any) => {
              const att = attendanceByMeeting.get(m.id);
              const tCount = tasksByMeeting.get(m.id) ?? 0;
              const hasNotes = !!notesByMeeting.get(m.id);
              const hasDec = (decisionsByMeeting.get(m.id) ?? 0) > 0;
              const empty = m.status === 'completed' && tCount === 0 && !hasNotes;
              return (
                <TableRow key={m.id} className={empty ? 'bg-warning/5' : ''}>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(m.scheduled_date), 'd MMM yyyy')}</TableCell>
                  <TableCell className="font-medium">{m.title}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{m.status.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="text-xs">{att ? `${att.present}/${att.total}` : '—'}</TableCell>
                  <TableCell>{tCount}</TableCell>
                  <TableCell>{hasNotes ? '✓' : '—'}</TableCell>
                  <TableCell>{hasDec ? '✓' : '—'}</TableCell>
                </TableRow>
              );
            })}
            {last20.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">No meetings</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}

/* ============================================================
 *  SECTION 4 — TASK ACCOUNTABILITY
 * ============================================================ */
function TaskAccountabilitySection({ data, period, lastUpdated, onRefresh }: any) {
  const { tasks, taskUpdates, profiles, meetings, kpiEntries } = data;
  const range = resolvePeriodRange(period);
  const start = range.start ? new Date(range.start) : new Date(0);
  const end = new Date(range.end);
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);

  const inPeriod = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };

  const openTasks = tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled');
  const overdueTasks = openTasks.filter((t: any) => t.due_date < todayDate);

  // due date pushbacks
  const dueChangesByTask = new Map<string, number>();
  taskUpdates.forEach((u: any) => {
    if (u.update_type === 'due_date_change') {
      dueChangesByTask.set(u.task_id, (dueChangesByTask.get(u.task_id) ?? 0) + 1);
    }
  });
  const repeated = Array.from(dueChangesByTask.entries()).filter(([, c]) => c >= 2).length;

  const completedTasks = tasks.filter((t: any) => t.status === 'completed' && t.completed_at);
  const avgDays = completedTasks.length === 0 ? 0 : Math.round(
    completedTasks.reduce((s: number, t: any) => s + (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 86400000, 0) / completedTasks.length,
  );

  // per-person aggregation
  const lastTaskActivity = new Map<string, number>();
  tasks.forEach((t: any) => {
    if (!t.owner_id) return;
    const t1 = new Date(t.created_at).getTime();
    if (!lastTaskActivity.has(t.owner_id) || lastTaskActivity.get(t.owner_id)! < t1) lastTaskActivity.set(t.owner_id, t1);
  });
  taskUpdates.forEach((u: any) => {
    const tk = tasks.find((t: any) => t.id === u.task_id);
    if (!tk?.owner_id) return;
    const t1 = new Date(u.created_at).getTime();
    if (!lastTaskActivity.has(tk.owner_id) || lastTaskActivity.get(tk.owner_id)! < t1) lastTaskActivity.set(tk.owner_id, t1);
  });

  const ownerIds = new Set<string>(tasks.map((t: any) => t.owner_id).filter(Boolean));
  const profileById = new Map<string, any>(profiles.map((p: any) => [p.id, p]));

  const personRows = Array.from(ownerIds).map((uid) => {
    const owned = tasks.filter((t: any) => t.owner_id === uid);
    const open = owned.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled').length;
    const overdue = owned.filter((t: any) => (t.status !== 'completed' && t.status !== 'cancelled') && t.due_date < todayDate).length;
    const completed = owned.filter((t: any) => t.status === 'completed').length;
    const total = owned.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const completedSet = owned.filter((t: any) => t.status === 'completed' && t.completed_at);
    const avgComplete = completedSet.length === 0 ? 0 : Math.round(
      completedSet.reduce((s: number, t: any) => s + (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 86400000, 0) / completedSet.length,
    );
    let pushbacks = 0;
    owned.forEach((t: any) => { pushbacks += dueChangesByTask.get(t.id) ?? 0; });
    const lastMs = lastTaskActivity.get(uid) ?? null;
    return {
      uid,
      name: profileById.get(uid)?.full_name ?? '—',
      open, overdue, completionRate, avgComplete, pushbacks,
      lastActivity: lastMs ? new Date(lastMs) : null,
    };
  });
  personRows.sort((a, b) => b.overdue - a.overdue);

  // overdue trend per week
  const weeks: { week: string; overdue: number }[] = [];
  const weekStart = new Date(start);
  weekStart.setHours(0, 0, 0, 0);
  for (let cur = new Date(weekStart); cur <= end; cur.setDate(cur.getDate() + 7)) {
    const wkLabel = format(cur, 'd MMM');
    const cutoff = cur.toISOString().slice(0, 10);
    const count = tasks.filter((t: any) =>
      t.status !== 'completed' && t.status !== 'cancelled' && t.due_date < cutoff && t.created_at <= cur.toISOString()
    ).length;
    weeks.push({ week: wkLabel, overdue: count });
  }

  // ---- non-compliance signals ----
  // recompute last activity across kpi/tasks/updates per user (same as section 1)
  const lastAnyActivity = new Map<string, number>();
  const updateLast = (uid: string, iso: string) => {
    const t = new Date(iso).getTime();
    if (!lastAnyActivity.has(uid) || lastAnyActivity.get(uid)! < t) lastAnyActivity.set(uid, t);
  };
  kpiEntries.forEach((e: any) => e.submitted_by && updateLast(e.submitted_by, e.submitted_at));
  taskUpdates.forEach((u: any) => u.updated_by && updateLast(u.updated_by, u.created_at));
  tasks.forEach((t: any) => { if (t.created_by) updateLast(t.created_by, t.created_at); if (t.assigned_by) updateLast(t.assigned_by, t.created_at); });

  const nowMs = Date.now();
  const idle14 = profiles.filter((p: any) => {
    const last = lastAnyActivity.get(p.id);
    if (!last) return true;
    return (nowMs - last) / 86400000 >= 14;
  });

  const usersWithoutTaskOrComment = profiles.filter((p: any) => {
    const created = tasks.some((t: any) => t.created_by === p.id || t.assigned_by === p.id);
    const commented = taskUpdates.some((u: any) => u.updated_by === p.id && u.update_type === 'comment');
    return !created && !commented;
  });

  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentMeetings = meetings.filter((m: any) => new Date(m.scheduled_date) >= sevenDaysAgo);
  const tasksByMeeting = new Map<string, number>();
  tasks.forEach((t: any) => { if (t.origin_meeting_id) tasksByMeeting.set(t.origin_meeting_id, (tasksByMeeting.get(t.origin_meeting_id) ?? 0) + 1); });
  const recentZeroTask = recentMeetings.filter((m: any) => !tasksByMeeting.get(m.id)).length;

  const repeatedPushbackTasks = Array.from(dueChangesByTask.entries())
    .filter(([, c]) => c >= 3)
    .map(([id]) => tasks.find((t: any) => t.id === id))
    .filter(Boolean);

  return (
    <Section title="Task Accountability" lastUpdated={lastUpdated} onRefresh={onRefresh}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Open tasks" value={formatIndianNumber(openTasks.length)} />
        <StatCard label="Overdue" value={formatIndianNumber(overdueTasks.length)} accent={overdueTasks.length > 0 ? 'red' : 'green'} />
        <StatCard label="Repeated pushbacks (2+)" value={formatIndianNumber(repeated)} accent={repeated > 0 ? 'amber' : undefined} />
        <StatCard label="Avg completion (days)" value={formatIndianNumber(avgDays)} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assignee</TableHead>
              <TableHead>Open</TableHead>
              <TableHead>Overdue</TableHead>
              <TableHead>Completion %</TableHead>
              <TableHead>Avg Days</TableHead>
              <TableHead>Pushbacks</TableHead>
              <TableHead>Last Activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personRows.map((r) => (
              <TableRow key={r.uid} className={r.overdue > 3 ? 'bg-destructive/10' : ''}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.open}</TableCell>
                <TableCell className={r.overdue > 3 ? 'font-semibold text-destructive' : ''}>{r.overdue}</TableCell>
                <TableCell>{r.completionRate}%</TableCell>
                <TableCell>{r.avgComplete}</TableCell>
                <TableCell>{r.pushbacks}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.lastActivity ? format(r.lastActivity, 'd MMM yyyy') : '—'}</TableCell>
              </TableRow>
            ))}
            {personRows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">No assignees</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {weeks.length > 0 && (
        <div className="mt-4 h-56" data-export-chart="overdue-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeks}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="overdue" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Non-compliance signals */}
      <div className="mt-6 space-y-3 rounded-md border bg-muted/30 p-4">
        <h3 className="text-sm font-semibold text-foreground">Non-compliance signals</h3>
        <SignalRow severity="red" icon={<AlertCircle className="h-4 w-4" />}
          label={`Users idle 14+ days (${idle14.length})`}
          detail={idle14.slice(0, 8).map((u: any) => u.full_name).join(', ') || 'None'} />
        <SignalRow severity="amber" icon={<AlertTriangle className="h-4 w-4" />}
          label={`Users who never created a task or comment (${usersWithoutTaskOrComment.length})`}
          detail={usersWithoutTaskOrComment.slice(0, 8).map((u: any) => u.full_name).join(', ') || 'None'} />
        <SignalRow severity="amber" icon={<AlertTriangle className="h-4 w-4" />}
          label={`Meetings in last 7 days with no tasks created`}
          detail={String(recentZeroTask)} />
        <SignalRow severity="amber" icon={<AlertTriangle className="h-4 w-4" />}
          label={`Tasks with 3+ due-date changes (${repeatedPushbackTasks.length})`}
          detail={repeatedPushbackTasks.slice(0, 6).map((t: any) => t.title).join(', ') || 'None'} />
      </div>
    </Section>
  );
}

function SignalRow({ severity, icon, label, detail }: { severity: 'red' | 'amber'; icon: React.ReactNode; label: string; detail: string }) {
  const cls = severity === 'red' ? 'text-destructive' : 'text-warning';
  return (
    <div className="flex items-start gap-2">
      <span className={cls}>{icon}</span>
      <div className="flex-1">
        <p className={cn('text-sm font-medium', cls)}>{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export { BarChart2 }; // re-export for nav usage convenience

/* ============================================================
 *  Export payload builder — derives PDF data from fetched batch
 * ============================================================ */
function buildAnalyticsPdfPayload(
  data: any,
  period: AnalyticsPeriod,
  periodLabel: string,
  generatedBy: { name: string; role: string },
): AnalyticsPdfPayload {
  const range = resolvePeriodRange(period);
  const start = range.start ? new Date(range.start) : new Date(0);
  const end = new Date(range.end);
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);
  const startMs = start.getTime();
  const inPeriod = (iso: string) => {
    const t = new Date(iso).getTime();
    return t >= startMs && t <= end.getTime();
  };

  const { profiles, roles, userDepts, depts, kpiEntries, kpiMaster, taskUpdates, tasks, meetings, attendance, discussion, decisions } = data;

  // ---- People rows ----
  const deptById = new Map<string, any>(depts.map((d: any) => [d.id, d]));
  const userDeptsBy = new Map<string, string[]>();
  userDepts.forEach((ud: any) => {
    const arr = userDeptsBy.get(ud.user_id) ?? [];
    const d = deptById.get(ud.department_id);
    if (d) arr.push(d.code);
    userDeptsBy.set(ud.user_id, arr);
  });
  const roleByUser = new Map<string, string>();
  roles.forEach((r: any) => { if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role); });

  const lastActivity = new Map<string, number>();
  const entryCount = new Map<string, number>();
  const updateCount = new Map<string, number>();
  const taskCreatedCount = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
  const updateLast = (uid: string, iso: string) => {
    const t = new Date(iso).getTime();
    if (!lastActivity.has(uid) || lastActivity.get(uid)! < t) lastActivity.set(uid, t);
  };
  kpiEntries.forEach((e: any) => {
    if (!e.submitted_by) return;
    updateLast(e.submitted_by, e.submitted_at);
    if (new Date(e.submitted_at).getTime() >= startMs) bump(entryCount, e.submitted_by);
  });
  taskUpdates.forEach((u: any) => {
    if (!u.updated_by) return;
    updateLast(u.updated_by, u.created_at);
    if (new Date(u.created_at).getTime() >= startMs) bump(updateCount, u.updated_by);
  });
  tasks.forEach((t: any) => {
    if (t.created_by) {
      updateLast(t.created_by, t.created_at);
      if (new Date(t.created_at).getTime() >= startMs) bump(taskCreatedCount, t.created_by);
    }
    if (t.assigned_by) updateLast(t.assigned_by, t.created_at);
  });

  const nowMs = Date.now();
  const peopleRowsAll = profiles.map((p: any) => {
    const lastMs = lastActivity.get(p.id) ?? null;
    const days = lastMs == null ? null : Math.floor((nowMs - lastMs) / 86400000);
    const score = getActivityScore(entryCount.get(p.id) ?? 0, updateCount.get(p.id) ?? 0, taskCreatedCount.get(p.id) ?? 0);
    return {
      id: p.id, name: p.full_name, role: roleByUser.get(p.id) ?? '—',
      depts: (userDeptsBy.get(p.id) ?? []).join(', ') || '—',
      lastActivity: lastMs ? new Date(lastMs) : null,
      days, score, status: getActivityStatus(days),
    };
  });
  peopleRowsAll.sort((a: any, b: any) => STATUS_SORT_ORDER[a.status as ActivityStatus] - STATUS_SORT_ORDER[b.status as ActivityStatus]);

  const breakdown = { active: 0, idle: 0, inactive: 0, never: 0 };
  peopleRowsAll.forEach((r: any) => { (breakdown as any)[r.status] += 1; });

  // ---- Compliance rows ----
  const numericKpis = kpiMaster.filter((k: any) => k.kpi_type === 'numeric');
  const kpisByDept = new Map<string, any[]>();
  numericKpis.forEach((k: any) => {
    const arr = kpisByDept.get(k.department_id) ?? [];
    arr.push(k); kpisByDept.set(k.department_id, arr);
  });
  const periodEnd = end > today ? today : end;
  const wd = workingDaysElapsed(start, periodEnd);
  const kpiToDept = new Map<string, string>(numericKpis.map((k: any) => [k.id, k.department_id]));
  const entriesByDept = new Map<string, any[]>();
  kpiEntries.forEach((e: any) => {
    if (!inPeriod(e.submitted_at)) return;
    const did = kpiToDept.get(e.kpi_id);
    if (!did) return;
    const arr = entriesByDept.get(did) ?? [];
    arr.push(e); entriesByDept.set(did, arr);
  });
  const complianceRowsAll = depts.map((d: any) => {
    const kpis = kpisByDept.get(d.id) ?? [];
    const expected = kpis.length * wd;
    const entries = entriesByDept.get(d.id) ?? [];
    const actual = entries.length;
    const late = entries.filter((e: any) => e.is_late_entry).length;
    const lastEntryISO = entries.reduce((m: string | null, e: any) => (!m || e.submitted_at > m ? e.submitted_at : m), null as string | null);
    return {
      id: d.id, name: d.name,
      expected, actual,
      compliance: calculateComplianceRate(actual, expected),
      late,
      lastEntry: lastEntryISO ? format(new Date(lastEntryISO), 'd MMM yyyy') : '—',
    };
  });
  complianceRowsAll.sort((a: any, b: any) => a.compliance - b.compliance);

  const totalExpected = complianceRowsAll.reduce((s: number, r: any) => s + r.expected, 0);
  const totalActual = complianceRowsAll.reduce((s: number, r: any) => s + r.actual, 0);
  const factoryRate = calculateComplianceRate(totalActual, totalExpected);

  // ---- Meeting rows ----
  const tasksByMeeting = new Map<string, number>();
  tasks.forEach((t: any) => { if (t.origin_meeting_id) tasksByMeeting.set(t.origin_meeting_id, (tasksByMeeting.get(t.origin_meeting_id) ?? 0) + 1); });
  const notesByMeeting = new Map<string, boolean>();
  discussion.forEach((d: any) => { if (d.notes && d.notes.trim()) notesByMeeting.set(d.meeting_id, true); });
  const decisionsByMeeting = new Map<string, number>();
  decisions.forEach((d: any) => decisionsByMeeting.set(d.meeting_id, (decisionsByMeeting.get(d.meeting_id) ?? 0) + 1));
  const attendanceByMeeting = new Map<string, { present: number; total: number }>();
  attendance.forEach((a: any) => {
    const cur = attendanceByMeeting.get(a.meeting_id) ?? { present: 0, total: 0 };
    cur.total += 1;
    if (a.status === 'present') cur.present += 1;
    attendanceByMeeting.set(a.meeting_id, cur);
  });
  const meetingsInPeriod = meetings.filter((m: any) => inPeriod(m.scheduled_date));
  const weekSpan = Math.max(1, Math.ceil((end.getTime() - startMs) / (7 * 86400000)));
  const meetingFreq = (meetingsInPeriod.length / weekSpan).toFixed(1);
  const last20Meetings = [...meetings].slice(0, 20).map((m: any) => {
    const att = attendanceByMeeting.get(m.id);
    return {
      date: format(new Date(m.scheduled_date), 'd MMM yyyy'),
      title: m.title,
      status: m.status,
      attendance: att ? `${att.present}/${att.total}` : '—',
      tasks: tasksByMeeting.get(m.id) ?? 0,
      notes: notesByMeeting.get(m.id) ? 'Yes' : 'No',
      decisions: (decisionsByMeeting.get(m.id) ?? 0) > 0 ? 'Yes' : 'No',
    };
  });

  // ---- Task rows ----
  const dueChangesByTask = new Map<string, number>();
  taskUpdates.forEach((u: any) => {
    if (u.update_type === 'due_date_change') {
      dueChangesByTask.set(u.task_id, (dueChangesByTask.get(u.task_id) ?? 0) + 1);
    }
  });
  const ownerIds = new Set<string>(tasks.map((t: any) => t.owner_id).filter(Boolean));
  const profileById = new Map<string, any>(profiles.map((p: any) => [p.id, p]));
  const lastTaskActivity = new Map<string, number>();
  tasks.forEach((t: any) => {
    if (!t.owner_id) return;
    const t1 = new Date(t.created_at).getTime();
    if (!lastTaskActivity.has(t.owner_id) || lastTaskActivity.get(t.owner_id)! < t1) lastTaskActivity.set(t.owner_id, t1);
  });
  const taskHealthRowsAll = Array.from(ownerIds).map((uid) => {
    const owned = tasks.filter((t: any) => t.owner_id === uid);
    const open = owned.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled').length;
    const overdue = owned.filter((t: any) => (t.status !== 'completed' && t.status !== 'cancelled') && t.due_date < todayDate).length;
    const completed = owned.filter((t: any) => t.status === 'completed').length;
    const total = owned.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const completedSet = owned.filter((t: any) => t.status === 'completed' && t.completed_at);
    const avgDays = completedSet.length === 0 ? 0 : Math.round(
      completedSet.reduce((s: number, t: any) => s + (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / 86400000, 0) / completedSet.length,
    );
    let pushbacks = 0;
    owned.forEach((t: any) => { pushbacks += dueChangesByTask.get(t.id) ?? 0; });
    const lastMs = lastTaskActivity.get(uid) ?? null;
    return {
      name: profileById.get(uid)?.full_name ?? '—',
      open, overdue, completionRate, avgDays, pushbacks,
      lastActivity: lastMs ? format(new Date(lastMs), 'd MMM yyyy') : '—',
    };
  });
  taskHealthRowsAll.sort((a, b) => b.overdue - a.overdue);

  // ---- Executive summary inputs ----
  const inactiveUsers = peopleRowsAll
    .filter((r: any) => r.days === null || r.days >= 14)
    .map((r: any) => ({ id: r.id, name: r.name }));
  const lowComplianceDepts = complianceRowsAll
    .filter((r: any) => r.expected > 0 && r.compliance < 50)
    .map((r: any) => ({ id: r.id, name: r.name, compliance: r.compliance }));
  const pushbackTasks = Array.from(dueChangesByTask.entries())
    .filter(([, c]) => c >= 3)
    .map(([id, c]) => {
      const t = tasks.find((x: any) => x.id === id);
      return { id, title: t?.title ?? '(unknown)', pushbacks: c };
    });
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const zeroTaskMeetingsThisWeek = meetings
    .filter((m: any) => new Date(m.scheduled_date) >= sevenDaysAgo)
    .filter((m: any) => !tasksByMeeting.get(m.id)).length;

  const openTasks = tasks.filter((t: any) => t.status !== 'completed' && t.status !== 'cancelled');
  const overdueTasks = openTasks.filter((t: any) => t.due_date < todayDate);
  const activeWeek = peopleRowsAll.filter((r: any) => r.days !== null && r.days <= 7).length;
  const overallActivityRate = profiles.length === 0
    ? '0%'
    : `${Math.round((activeWeek / profiles.length) * 100)}%`;

  return {
    periodLabel,
    generatedBy,
    summary: {
      inactiveUsers,
      lowComplianceDepts,
      pushbackTasks,
      zeroTaskMeetingsThisWeek,
      overallActivityRate,
      factoryComplianceRate: `${factoryRate}%`,
      meetingFrequencyThisMonth: `${meetingFreq} / week (${meetingsInPeriod.length} total)`,
      openTaskCount: openTasks.length,
      overdueTaskCount: overdueTasks.length,
    },
    peopleStatusBreakdown: breakdown,
    peopleRows: peopleRowsAll.map((r: any) => ({
      name: r.name, role: r.role, depts: r.depts,
      lastActivity: r.lastActivity ? format(r.lastActivity, 'd MMM yyyy') : '—',
      score: r.score, status: r.status,
    })),
    complianceRows: complianceRowsAll.map((r: any) => ({
      name: r.name, expected: r.expected, actual: r.actual,
      compliance: r.compliance, late: r.late, lastEntry: r.lastEntry,
    })),
    meetingRows: last20Meetings,
    taskHealthRows: taskHealthRowsAll,
  };
}
