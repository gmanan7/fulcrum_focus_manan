import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DB } from '@/integrations/apiClient';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, subDays, differenceInDays, startOfMonth, endOfMonth, subMonths, parseISO } from 'date-fns';
import { cn, getDecisionTaskStatus, type DecisionTaskStatus } from '@/lib/utils';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  CalendarIcon, ChevronDown, ChevronRight, Search, Filter,
  ClipboardList, CheckCircle2,
} from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-primary/10 text-primary',
  in_progress: 'bg-rag-amber/20 text-warning',
  blocked: 'bg-destructive/10 text-destructive',
  completed: 'bg-rag-green/20 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

const MEETING_STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-primary/10 text-primary',
  in_progress: 'bg-rag-amber/20 text-warning',
  completed: 'bg-rag-green/20 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

type TaskFilter = 'all' | 'has_task' | 'no_task' | 'overdue' | 'completed';

interface DecisionRow {
  id: string;
  decision_text: string;
  created_at: string;
  linked_task_id: string | null;
  discussion_point_id: string | null;
  meeting_id: string;
  discussion_point: { title: string } | null;
  author: { full_name: string } | null;
  task: {
    id: string;
    task_number: number;
    title: string;
    status: string;
    due_date: string;
    owner: { full_name: string } | null;
    dept: { name: string } | null;
  } | null;
  meeting: {
    id: string;
    title: string;
    scheduled_date: string;
    status: string;
    summary: string | null;
  };
}

interface MeetingGroup {
  meeting: DecisionRow['meeting'];
  decisions: DecisionRow[];
}

export default function DecisionLog() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const today = new Date();

  const [fromDate, setFromDate] = useState<Date>(subDays(today, 30));
  const [toDate, setToDate] = useState<Date>(today);
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [showMeetingNotes, setShowMeetingNotes] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(!isMobile);

  const fromStr = format(fromDate, 'yyyy-MM-dd');
  const toStr = format(toDate, 'yyyy-MM-dd');

  const { data: decisions, isLoading } = useQuery({
    queryKey: ['decision-log', fromStr, toStr, taskFilter],
    queryFn: async () => {
      let query = DB
        .from('meeting_decisions')
        .select(`
          id, decision_text, created_at, linked_task_id, discussion_point_id, meeting_id,
          discussion_point:meeting_discussion_points!meeting_decisions_discussion_point_id_fkey(title),
          author:profiles!meeting_decisions_created_by_fkey(full_name),
          task:tasks!fk_decision_task(
            id, task_number, title, status, due_date,
            owner:profiles!tasks_owner_id_fkey(full_name),
            dept:department!tasks_department_id_fkey(name)
          ),
          meeting:meetings!meeting_decisions_meeting_id_fkey(
            id, title, scheduled_date, status, summary
          )
        `)
        .gte('meeting.scheduled_date', fromStr)
        .lte('meeting.scheduled_date', toStr)
        .order('created_at', { ascending: false });

      if (taskFilter === 'has_task') {
        query = query.not('linked_task_id', 'is', null);
      } else if (taskFilter === 'no_task') {
        query = query.is('linked_task_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter out rows where meeting join returned null (outside date range)
      let rows = (data || []).filter((d: any) => d.meeting !== null) as DecisionRow[];

      // Client-side filters for task status
      if (taskFilter === 'overdue') {
        rows = rows.filter((d) => {
          if (!d.task) return false;
          return getDecisionTaskStatus(d.task as any) === 'overdue';
        });
      } else if (taskFilter === 'completed') {
        rows = rows.filter((d) => d.task?.status === 'completed');
      }

      return rows;
    },
  });

  // Apply search filter client-side
  const filtered = useMemo(() => {
    if (!decisions) return [];
    if (!searchText.trim()) return decisions;
    const lower = searchText.toLowerCase();
    return decisions.filter((d) => d.decision_text.toLowerCase().includes(lower));
  }, [decisions, searchText]);

  // Group by meeting
  const grouped = useMemo(() => {
    const map = new Map<string, MeetingGroup>();
    for (const d of filtered) {
      const mid = d.meeting.id;
      if (!map.has(mid)) {
        map.set(mid, { meeting: d.meeting, decisions: [] });
      }
      map.get(mid)!.decisions.push(d);
    }
    // Sort meetings by date descending
    return Array.from(map.values()).sort(
      (a, b) => b.meeting.scheduled_date.localeCompare(a.meeting.scheduled_date)
    );
  }, [filtered]);

  // Summary stats
  const stats = useMemo(() => {
    if (!decisions) return { total: 0, withTask: 0, withoutTask: 0, overdue: 0 };
    const withTask = decisions.filter((d) => d.linked_task_id).length;
    const overdue = decisions.filter((d) => d.task && getDecisionTaskStatus(d.task as any) === 'overdue').length;
    return {
      total: decisions.length,
      withTask,
      withoutTask: decisions.length - withTask,
      overdue,
    };
  }, [decisions]);

  const toggleMeeting = (id: string) => {
    setExpandedMeetings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setAllExpanded(false);
  };

  const isMeetingExpanded = (id: string) => {
    if (allExpanded) return true;
    return expandedMeetings.has(id);
  };

  const setQuickRange = (from: Date, to: Date) => {
    setFromDate(from);
    setToDate(to);
  };

  const filterContent = (
    <div className="space-y-3">
      {/* Date range */}
      <div className="flex flex-wrap gap-2">
        <DatePicker label="From" date={fromDate} onSelect={(d) => d && setFromDate(d)} />
        <DatePicker label="To" date={toDate} onSelect={(d) => d && setToDate(d)} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: 'Last 7 days', from: subDays(today, 7), to: today },
          { label: 'Last 30 days', from: subDays(today, 30), to: today },
          { label: 'This Month', from: startOfMonth(today), to: endOfMonth(today) },
          { label: 'Last Month', from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) },
        ].map((r) => (
          <Button
            key={r.label}
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => setQuickRange(r.from, r.to)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      {/* Task filter + search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={taskFilter} onValueChange={(v) => setTaskFilter(v as TaskFilter)}>
          <SelectTrigger className="h-9 w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Decisions</SelectItem>
            <SelectItem value="has_task">Has Linked Task</SelectItem>
            <SelectItem value="no_task">No Linked Task</SelectItem>
            <SelectItem value="overdue">Has Overdue Task</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search decisions..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Show meeting notes toggle */}
      <div className="flex items-center gap-2">
        <Switch id="meeting-notes" checked={showMeetingNotes} onCheckedChange={setShowMeetingNotes} />
        <Label htmlFor="meeting-notes" className="text-xs text-muted-foreground cursor-pointer">
          Show meeting notes
        </Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Decision Log</h1>
        <p className="text-sm text-muted-foreground">All decisions recorded across meetings</p>
      </div>

      {/* Filter bar */}
      {isMobile ? (
        <>
          <Button variant="outline" size="sm" className="w-full" onClick={() => setMobileFilterOpen(true)}>
            <Filter className="h-4 w-4 mr-2" /> Filters
          </Button>
          <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
              <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
              <div className="py-4">{filterContent}</div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Card>
          <CardContent className="p-4">{filterContent}</CardContent>
        </Card>
      )}

      {/* Summary bar */}
      <div className={cn('flex flex-wrap gap-2', isMobile && 'grid grid-cols-2')}>
        <StatChip label={`${stats.total} decisions`} onClick={() => setTaskFilter('all')} active={taskFilter === 'all'} />
        <StatChip label={`${stats.withTask} with tasks`} onClick={() => setTaskFilter('has_task')} active={taskFilter === 'has_task'} />
        <StatChip label={`${stats.withoutTask} without tasks`} onClick={() => setTaskFilter('no_task')} active={taskFilter === 'no_task'} />
        <StatChip label={`${stats.overdue} overdue tasks`} onClick={() => setTaskFilter('overdue')} active={taskFilter === 'overdue'} variant="destructive" />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}><CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-16 w-full" />
            </CardContent></Card>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {searchText ? `No decisions match '${searchText}'` : 'No decisions found'}
          </p>
          <p className="text-xs text-muted-foreground">
            {searchText
              ? 'Try a different search term'
              : 'Decisions recorded during meetings will appear here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <MeetingGroupCard
              key={group.meeting.id}
              group={group}
              expanded={isMeetingExpanded(group.meeting.id)}
              onToggle={() => toggleMeeting(group.meeting.id)}
              showMeetingNotes={showMeetingNotes}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────── */

function StatChip({ label, onClick, active, variant }: {
  label: string; onClick: () => void; active: boolean; variant?: 'destructive';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
        active
          ? variant === 'destructive'
            ? 'bg-destructive/10 text-destructive border-destructive/20'
            : 'bg-primary/10 text-primary border-primary/20'
          : 'bg-card text-muted-foreground border-border hover:bg-muted/50'
      )}
    >
      {label}
    </button>
  );
}

function DatePicker({ label, date, onSelect }: {
  label: string; date: Date; onSelect: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5" />
          {label}: {format(date, 'dd MMM yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

function MeetingGroupCard({ group, expanded, onToggle, showMeetingNotes, navigate }: {
  group: MeetingGroup; expanded: boolean; onToggle: () => void;
  showMeetingNotes: boolean; navigate: ReturnType<typeof useNavigate>;
}) {
  const m = group.meeting;
  return (
    <div
      className="rounded-xl border shadow-sm overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}
    >
      {/* Meeting header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left border-l-4 border-indigo-500"
      >
        {expanded ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {format(parseISO(m.scheduled_date), 'dd MMM yyyy')}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>—</span>
            <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{m.title}</span>
            <Badge className={cn('text-[10px]', MEETING_STATUS_COLORS[m.status] || 'bg-muted text-muted-foreground')}>
              {m.status}
            </Badge>
          </div>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">{group.decisions.length} decision{group.decisions.length !== 1 ? 's' : ''}</span>
      </button>

      {/* Decisions */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {group.decisions.map((d) => (
            <DecisionCard key={d.id} decision={d} navigate={navigate} />
          ))}

          {/* Meeting notes */}
          {showMeetingNotes && (
            <Collapsible>
              <CollapsibleTrigger className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1 pt-2">
                <ChevronRight className="h-3 w-3" /> Notes from this meeting
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 p-3 rounded-lg text-sm text-muted-foreground" style={{ background: 'var(--bg-muted, hsl(var(--muted)))' }}>
                  {m.summary ? m.summary : <em>No notes recorded</em>}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionCard({ decision: d, navigate }: { decision: DecisionRow; navigate: ReturnType<typeof useNavigate> }) {
  const taskStatus = getDecisionTaskStatus(
    d.task ? { status: d.task.status, due_date: d.task.due_date } : null
  );

  const cardBg = taskStatus === 'resolved'
    ? 'bg-emerald-50 dark:bg-emerald-950/20'
    : taskStatus === 'overdue'
      ? 'bg-rose-50 dark:bg-rose-950/20'
      : '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysAgo = differenceInDays(today, new Date(d.created_at));
  const relativeTime = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo} days ago`;

  return (
    <div
      className={cn('rounded-xl border shadow-sm p-3 relative', cardBg)}
      style={{ borderColor: 'var(--border-card)' }}
    >
      {/* Resolved chip */}
      {taskStatus === 'resolved' && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-full">
            <CheckCircle2 className="h-3 w-3" /> Done
          </span>
        </div>
      )}

      {/* Decision text */}
      <p className="text-sm font-medium pr-16" style={{ color: 'var(--text-primary)' }}>{d.decision_text}</p>

      {/* Discussion point context */}
      {d.discussion_point && (
        <span className="inline-block mt-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          Re: {d.discussion_point.title}
        </span>
      )}

      {/* Task chip or no-task label */}
      <div className="mt-2">
        {d.task ? (
          <button
            onClick={() => navigate('/tasks')}
            className="flex flex-wrap items-center gap-1.5 text-xs p-1.5 rounded-lg border bg-card hover:bg-muted/50 transition-colors w-full text-left"
            style={{ borderColor: 'var(--border-card)' }}
          >
            <span className="font-medium text-indigo-600 dark:text-indigo-400">Task #{d.task.task_number}</span>
            <span className="truncate max-w-[160px]" style={{ color: 'var(--text-primary)' }}>
              {d.task.title.length > 40 ? d.task.title.slice(0, 40) + '…' : d.task.title}
            </span>
            {d.task.owner && (
              <span className="text-muted-foreground">· {d.task.owner.full_name}</span>
            )}
            <TaskDueBadge dueDate={d.task.due_date} status={d.task.status} />
            <Badge className={cn('text-[10px] ml-auto', STATUS_COLORS[d.task.status] || 'bg-muted text-muted-foreground')}>
              {d.task.status.replace('_', ' ')}
            </Badge>
          </button>
        ) : (
          <span className="inline-block text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full px-2 py-0.5">
            No task linked
          </span>
        )}
      </div>

      {/* Recorded by */}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Recorded by {d.author?.full_name || 'Unknown'} · {relativeTime}
      </p>
    </div>
  );
}

function TaskDueBadge({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === 'completed' || status === 'cancelled') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate + 'T00:00:00');
  const diff = differenceInDays(due, today);

  if (diff < 0) {
    return <span className="text-[10px] text-destructive font-medium">{Math.abs(diff)}d overdue</span>;
  }
  if (diff === 0) {
    return <span className="text-[10px] text-warning font-medium">Due today</span>;
  }
  return <span className="text-[10px] text-muted-foreground">Due {format(due, 'dd MMM')}</span>;
}
