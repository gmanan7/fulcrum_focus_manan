import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, subDays, differenceInMinutes, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarDays, Clock, Users, AlertTriangle, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

type QuickRange = '7d' | '30d' | 'this_month' | 'last_month';

function getRange(q: QuickRange): [string, string] {
  const now = new Date();
  switch (q) {
    case '7d': return [format(subDays(now, 7), 'yyyy-MM-dd'), format(now, 'yyyy-MM-dd')];
    case '30d': return [format(subDays(now, 30), 'yyyy-MM-dd'), format(now, 'yyyy-MM-dd')];
    case 'this_month': return [format(startOfMonth(now), 'yyyy-MM-dd'), format(now, 'yyyy-MM-dd')];
    case 'last_month': { const lm = subMonths(now, 1); return [format(startOfMonth(lm), 'yyyy-MM-dd'), format(endOfMonth(lm), 'yyyy-MM-dd')]; }
  }
}

export default function Compliance() {
  const isMobile = useIsMobile();
  const [range, setRange] = useState<QuickRange>('30d');
  const [from, to] = getRange(range);

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['compliance-meetings', from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)
        .order('scheduled_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const meetingIds = meetings?.map((m) => m.id) || [];

  const { data: invitees } = useQuery({
    queryKey: ['compliance-invitees', meetingIds.join(',')],
    queryFn: async () => {
      if (!meetingIds.length) return [];
      const { data } = await supabase.from('meeting_invitees').select('*').in('meeting_id', meetingIds);
      return data || [];
    },
    enabled: meetingIds.length > 0,
  });

  const { data: attendance } = useQuery({
    queryKey: ['compliance-attendance', meetingIds.join(',')],
    queryFn: async () => {
      if (!meetingIds.length) return [];
      const { data } = await supabase.from('meeting_attendance').select('*').in('meeting_id', meetingIds);
      return data || [];
    },
    enabled: meetingIds.length > 0,
  });

  const { data: redEntries } = useQuery({
    queryKey: ['compliance-red-entries', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('kpi_entries')
        .select('id, reporting_date, computed_status')
        .eq('computed_status', 'red')
        .gte('reporting_date', from)
        .lte('reporting_date', to);
      return data || [];
    },
  });

  const { data: kpiTasks } = useQuery({
    queryKey: ['compliance-kpi-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('tasks').select('origin_kpi_entry_id').not('origin_kpi_entry_id', 'is', null);
      return data || [];
    },
  });

  const taskEntryIds = useMemo(() => {
    const s = new Set<string>();
    kpiTasks?.forEach((t) => { if (t.origin_kpi_entry_id) s.add(t.origin_kpi_entry_id); });
    return s;
  }, [kpiTasks]);

  const rows = useMemo(() => {
    if (!meetings) return [];
    return meetings.map((m) => {
      const mInvitees = invitees?.filter((i) => i.meeting_id === m.id) || [];
      const mAttendance = attendance?.filter((a) => a.meeting_id === m.id) || [];
      const presentCount = mAttendance.filter((a) => a.status === 'present').length;
      const totalInvitees = mInvitees.length;
      const attendancePct = totalInvitees > 0 ? Math.round((presentCount / totalInvitees) * 100) : null;

      let delayMin: number | null = null;
      if (m.actual_start) {
        const scheduled = new Date(`${m.scheduled_date}T${m.scheduled_start_time}`);
        delayMin = differenceInMinutes(new Date(m.actual_start), scheduled);
      }

      let durationMin: number | null = null;
      if (m.actual_start && m.actual_end) {
        durationMin = differenceInMinutes(new Date(m.actual_end), new Date(m.actual_start));
      }

      const dateRedEntries = redEntries?.filter((e) => e.reporting_date === m.scheduled_date) || [];
      const unaddressedRed = dateRedEntries.filter((e) => !taskEntryIds.has(e.id)).length;

      return { meeting: m, delayMin, durationMin, attendancePct, totalInvitees, presentCount, unaddressedRed };
    });
  }, [meetings, invitees, attendance, redEntries, taskEntryIds]);

  // Summary
  const summary = useMemo(() => {
    const total = rows.length;
    const onTime = rows.filter((r) => r.delayMin !== null && r.delayMin <= 5).length;
    const avgAtt = rows.filter((r) => r.attendancePct !== null);
    const avgAttPct = avgAtt.length ? Math.round(avgAtt.reduce((a, r) => a + (r.attendancePct || 0), 0) / avgAtt.length) : 0;
    const totalUnaddressed = rows.reduce((a, r) => a + r.unaddressedRed, 0);
    return { total, onTime, onTimePct: total ? Math.round((onTime / total) * 100) : 0, avgAttPct, totalUnaddressed };
  }, [rows]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Meeting Compliance</h1>

      {/* Range buttons */}
      <div className="flex gap-2 flex-wrap">
        {([['7d', 'Last 7 days'], ['30d', 'Last 30 days'], ['this_month', 'This Month'], ['last_month', 'Last Month']] as const).map(([v, l]) => (
          <Button
            key={v}
            variant={range === v ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRange(v)}
          >
            {l}
          </Button>
        ))}
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryChip icon={<CalendarDays className="h-5 w-5 text-blue-400" />} label="Meetings Held" value={summary.total} />
        <SummaryChip icon={<Clock className="h-5 w-5 text-emerald-400" />} label="On-time Starts" value={`${summary.onTime} (${summary.onTimePct}%)`} />
        <SummaryChip icon={<Users className="h-5 w-5 text-blue-400" />} label="Avg Attendance" value={`${summary.avgAttPct}%`} />
        <SummaryChip icon={<AlertTriangle className="h-5 w-5 text-red-400" />} label="Red KPIs Unaddressed" value={summary.totalUnaddressed} />
      </div>

      {/* Table / Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <FileWarning className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-sm text-slate-500">No meetings in this period.</p>
        </CardContent></Card>
      ) : isMobile ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.meeting.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{r.meeting.title}</p>
                    <p className="text-xs text-slate-400">{format(new Date(r.meeting.scheduled_date), 'dd MMM yyyy')}</p>
                  </div>
                  <MeetingStatusBadge status={r.meeting.status} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400">Delay: </span>
                    <span className={cn(r.delayMin != null && r.delayMin > 15 ? 'text-red-600 font-medium' : r.delayMin != null && r.delayMin > 5 ? 'text-amber-600' : 'text-slate-600')}>
                      {r.delayMin != null ? `${r.delayMin} min` : 'Not started'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Duration: </span>
                    <span className="text-slate-600">{r.durationMin != null ? `${r.durationMin} min` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Attendance: </span>
                    <span className={cn(r.attendancePct != null && r.attendancePct < 60 ? 'text-red-600' : r.attendancePct != null && r.attendancePct < 80 ? 'text-amber-600' : 'text-slate-600')}>
                      {r.attendancePct != null ? `${r.attendancePct}%` : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Red w/o Action: </span>
                    <span className={cn(r.unaddressedRed > 0 ? 'text-red-600 font-medium' : 'text-slate-600')}>{r.unaddressedRed}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Date</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Meeting</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Sched. Start</th>
                  <th className="text-left px-4 py-2 font-medium text-slate-600">Actual Start</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Delay</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Duration</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Attendance</th>
                  <th className="text-right px-4 py-2 font-medium text-slate-600">Red w/o Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.meeting.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-700">{format(new Date(r.meeting.scheduled_date), 'dd MMM')}</td>
                    <td className="px-4 py-2 text-slate-700 font-medium">{r.meeting.title}</td>
                    <td className="px-4 py-2 text-slate-500">{r.meeting.scheduled_start_time?.slice(0, 5)}</td>
                    <td className="px-4 py-2 text-slate-500">{r.meeting.actual_start ? format(new Date(r.meeting.actual_start), 'HH:mm') : '—'}</td>
                    <td className={cn('px-4 py-2 text-right',
                      r.delayMin != null && r.delayMin > 15 ? 'text-red-600 font-medium' :
                      r.delayMin != null && r.delayMin > 5 ? 'text-amber-600' : 'text-slate-600')}>
                      {r.delayMin != null ? `${r.delayMin} min` : '—'}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">{r.durationMin != null ? `${r.durationMin} min` : '—'}</td>
                    <td className={cn('px-4 py-2 text-right',
                      r.attendancePct != null && r.attendancePct < 60 ? 'text-red-600' :
                      r.attendancePct != null && r.attendancePct < 80 ? 'text-amber-600' : 'text-slate-600')}>
                      {r.attendancePct != null ? `${r.attendancePct}%` : '—'}
                    </td>
                    <td className={cn('px-4 py-2 text-right', r.unaddressedRed > 0 ? 'text-red-600 font-medium' : 'text-slate-600')}>
                      {r.unaddressedRed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="p-3 md:p-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xl md:text-2xl font-bold text-slate-800">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MeetingStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    scheduled: 'bg-sky-100 text-sky-700 border border-sky-300',
    in_progress: 'bg-amber-100 text-amber-700 border border-amber-300',
    completed: 'bg-emerald-100 text-emerald-700 border border-emerald-300',
    cancelled: 'bg-slate-100 text-slate-500 border border-slate-300',
  };
  return <Badge className={cn('text-xs rounded-full px-2.5 py-0.5', cls[status])}>{status.replace('_', ' ')}</Badge>;
}
