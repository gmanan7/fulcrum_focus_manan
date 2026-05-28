import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Columns3, ListTodo, Lock, Users, Search, Info, CalendarDays, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, isTaskOverdue, isTaskDueToday } from '@/lib/utils';
import { formatDueDate, sortTasks, TASK_SORT_OPTIONS, type TaskSortKey } from '@/lib/taskSort';
import { isCarryover, buildPushCountMap } from '@/lib/taskCarryover';
import { searchMatches } from '@/lib/taskSearch';
import {
  canAccessTaskOverview,
  getVisibilityKind,
  matchesVisibilityFilter,
  type VisibilityFilter,
} from '@/lib/taskOverview';
import { TaskOverviewDrawer } from '@/components/tasks/TaskOverviewDrawer';
import { TaskCalendarView } from '@/components/tasks/TaskCalendarView';
import type { Database } from '@/integrations/supabase/types';

type TaskStatus = Database['public']['Enums']['task_status'];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-primary/10 text-primary',
  in_progress: 'bg-rag-amber/20 text-warning',
  blocked: 'bg-destructive/10 text-destructive',
  completed: 'bg-rag-green/20 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-rag-amber text-white',
  medium: 'bg-primary/10 text-primary',
  low: 'bg-muted text-muted-foreground',
};

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'open', label: 'Open' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'completed', label: 'Completed' },
  { status: 'cancelled', label: 'Cancelled' },
];

type View = 'kanban' | 'table' | 'calendar';

export default function AdminTaskOverview() {
  const { roles, user } = useAuth();
  const isMobile = useIsMobile();
  const allowed = canAccessTaskOverview(roles);

  const [view, setView] = useState<View>(isMobile ? 'table' : 'kanban');
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [sortKey, setSortKey] = useState<TaskSortKey>('created_desc');

  // Chip filters (compose with AND on top of the dropdown filters above)
  const [chipOverdue, setChipOverdue] = useState(false);
  const [chipDueToday, setChipDueToday] = useState(false);
  const [chipCarryover, setChipCarryover] = useState(false);
  const [chipMyTasks, setChipMyTasks] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ['departments-admin-tasks'],
    enabled: allowed,
    queryFn: async () => {
      const { data } = await supabase
        .from('department')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order');
      return data || [];
    },
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['admin-all-tasks'],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          '*, owner:profiles!tasks_owner_id_fkey(full_name), dept:department!tasks_department_id_fkey(name), assignedBy:profiles!tasks_assigned_by_fkey(full_name), group:task_groups!tasks_task_group_id_fkey(name, color), meeting:meetings!tasks_origin_meeting_id_fkey(id, title, scheduled_date)'
        )
        .order('created_at', { ascending: false })
        .range(0, 4999);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: carryover } = useQuery({
    queryKey: ['admin-task-carryover-history'],
    enabled: allowed,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_updates')
        .select('task_id')
        .eq('update_type', 'due_date_change');
      if (error) throw error;
      const rows = (data || []) as Array<{ task_id: string }>;
      return { ids: new Set(rows.map((r) => r.task_id)), counts: buildPushCountMap(rows) };
    },
  });

  const historyIds = carryover?.ids ?? new Set<string>();
  const pushCounts = carryover?.counts ?? new Map<string, number>();

  // group metadata map for calendar dot ring
  const groupMetaById = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    (tasks || []).forEach((t: any) => {
      if (t.task_group_id && t.group && !m.has(t.task_group_id)) {
        m.set(t.task_group_id, { name: t.group.name, color: t.group.color });
      }
    });
    return m;
  }, [tasks]);

  const filtered = useMemo(() => {
    const list = tasks || [];
    return list.filter((t: any) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!matchesVisibilityFilter(t, visibilityFilter)) return false;
      if (deptFilter !== 'all' && t.department_id !== deptFilter) return false;

      // Chip filters
      if (chipOverdue && !isTaskOverdue(t)) return false;
      if (chipDueToday && !isTaskDueToday(t)) return false;
      if (chipCarryover && !isCarryover(t, historyIds)) return false;
      if (chipMyTasks && user && t.owner_id !== user.id) return false;

      // Full search (title, description, owner, dept, #number, group, resolution note)
      if (!searchMatches(t, search)) return false;
      return true;
    });
  }, [tasks, statusFilter, visibilityFilter, deptFilter, search,
      chipOverdue, chipDueToday, chipCarryover, chipMyTasks, historyIds, user]);

  if (!allowed) return <Navigate to="/dashboard" replace />;

  const sorted = useMemo(() => sortTasks(filtered, sortKey), [filtered, sortKey]);

  const overdueCount = (tasks || []).filter((t: any) => isTaskOverdue(t)).length;
  const dueTodayCount = (tasks || []).filter((t: any) => isTaskDueToday(t)).length;
  const carryoverCount = (tasks || []).filter((t: any) => isCarryover(t, historyIds)).length;
  const myTasksCount = user ? (tasks || []).filter((t: any) => t.owner_id === user.id).length : 0;

  return (
    <div className="space-y-4 pb-12">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">Task Overview</h1>
          <p className="text-sm text-muted-foreground">
            All tasks across the organisation — read only
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex border rounded-md overflow-hidden">
            <Button
              size="sm"
              variant={view === 'kanban' ? 'default' : 'ghost'}
              className="h-8 rounded-none gap-1"
              onClick={() => setView('kanban')}
            >
              <Columns3 className="h-3.5 w-3.5" /> Kanban
            </Button>
            <Button
              size="sm"
              variant={view === 'table' ? 'default' : 'ghost'}
              className="h-8 rounded-none gap-1"
              onClick={() => setView('table')}
            >
              <ListTodo className="h-3.5 w-3.5" /> Table
            </Button>
            <Button
              size="sm"
              variant={view === 'calendar' ? 'default' : 'ghost'}
              className="h-8 rounded-none gap-1"
              onClick={() => setView('calendar')}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </Button>
          </div>

          <Select value={sortKey} onValueChange={(v) => setSortKey(v as TaskSortKey)}>
            <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Sort tasks">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7 w-[200px] text-xs"
              placeholder="Search tasks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tasks"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/40 p-3 flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          This view includes private and group-scoped tasks. Changes must be made by the
          task owner or assignee from the main Task Board.
        </p>
      </div>

      {/* Chip filters row */}
      <div className="flex flex-wrap items-center gap-2">
        <ChipToggle
          active={chipOverdue}
          onClick={() => setChipOverdue((v) => !v)}
          label="Overdue"
          count={overdueCount}
          tone="destructive"
        />
        <ChipToggle
          active={chipDueToday}
          onClick={() => setChipDueToday((v) => !v)}
          label="Due Today"
          count={dueTodayCount}
          tone="warning"
        />
        <ChipToggle
          active={chipCarryover}
          onClick={() => setChipCarryover((v) => !v)}
          label="Carryover"
          count={carryoverCount}
          tone="violet"
        />
        <ChipToggle
          active={chipMyTasks}
          onClick={() => setChipMyTasks((v) => !v)}
          label="My Tasks"
          count={myTasksCount}
          tone="primary"
        />
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Visibility</label>
              <Select value={visibilityFilter} onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="group">Group tasks only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Department</label>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : view === 'kanban' ? (
        <KanbanView tasks={sorted} onSelect={setSelected} historyIds={historyIds} />
      ) : view === 'calendar' ? (
        <TaskCalendarView
          tasks={sorted}
          historyIds={historyIds}
          groupMetaById={groupMetaById}
          departments={departments || []}
          onTaskClick={setSelected}
        />
      ) : (
        <TableView
          tasks={sorted}
          onSelect={setSelected}
          pushCounts={pushCounts}
        />
      )}

      <TaskOverviewDrawer
        task={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

// ---------- Chip ----------

function ChipToggle({
  active, onClick, label, count, tone,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: 'destructive' | 'warning' | 'violet' | 'primary';
}) {
  const toneClass =
    tone === 'destructive' ? 'border-destructive/40 text-destructive data-[on=true]:bg-destructive data-[on=true]:text-destructive-foreground'
    : tone === 'warning' ? 'border-warning/40 text-warning data-[on=true]:bg-warning data-[on=true]:text-white'
    : tone === 'violet' ? 'border-violet-500/40 text-violet-600 data-[on=true]:bg-violet-600 data-[on=true]:text-white'
    : 'border-primary/40 text-primary data-[on=true]:bg-primary data-[on=true]:text-primary-foreground';
  return (
    <button
      type="button"
      data-on={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
        toneClass,
      )}
    >
      <span>{label}</span>
      <span className={cn(
        'rounded-full px-1.5 text-[10px]',
        active ? 'bg-background/20' : 'bg-muted text-muted-foreground'
      )}>
        {count}
      </span>
    </button>
  );
}

// ---------- Kanban ----------

function KanbanView({
  tasks,
  onSelect,
  historyIds,
}: {
  tasks: any[];
  onSelect: (t: any) => void;
  historyIds: Set<string>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="rounded-lg border border-border bg-muted/20 p-2 flex flex-col min-h-[200px]">
            <div className="flex items-center justify-between px-1 pb-2">
              <h3 className="text-sm font-medium text-foreground">{col.label}</h3>
              <Badge variant="outline" className="text-xs">{colTasks.length}</Badge>
            </div>
            <div className="space-y-2">
              {colTasks.map((t) => (
                <KanbanCardRO key={t.id} task={t} onClick={() => onSelect(t)} historyIds={historyIds} />
              ))}
              {colTasks.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic px-1">No tasks</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCardRO({
  task,
  onClick,
  historyIds,
}: {
  task: any;
  onClick: () => void;
  historyIds: Set<string>;
}) {
  const visibility = getVisibilityKind(task);
  const due = formatDueDate(task.due_date);
  const carry = isCarryover(task, historyIds);
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-md border border-border bg-card p-2 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-1.5 flex-wrap mb-1">
        <span className="text-[11px] text-muted-foreground">#{task.task_number ?? '—'}</span>
        <Badge className={cn('text-[10px] px-1.5 py-0 capitalize', PRIORITY_COLORS[task.priority] || '')}>
          {task.priority}
        </Badge>
        {carry && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-500/40 text-violet-600">
            Carryover
          </Badge>
        )}
      </div>
      <p className="text-sm text-foreground line-clamp-2 mb-2">{task.title}</p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span>{task.owner?.full_name || '—'}</span>
          {task.dept?.name && <Badge variant="outline" className="text-[10px] px-1 py-0">{task.dept.name}</Badge>}
        </div>
        {due && <span className="text-[11px] text-muted-foreground">{due}</span>}
      </div>
      <div className="flex items-center gap-1 mt-1.5">
        {visibility === 'private' && <Lock className="h-3 w-3 text-warning" />}
        {visibility === 'group' && task.group && (
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] border"
            style={{ borderColor: task.group.color ?? undefined, color: task.group.color ?? undefined }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: task.group.color ?? undefined }}
            />
            {task.group.name}
          </span>
        )}
      </div>
    </button>
  );
}

// ---------- Table ----------

function TableView({
  tasks, onSelect, pushCounts,
}: {
  tasks: any[];
  onSelect: (t: any) => void;
  pushCounts: Map<string, number>;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Group / Team</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Push Count</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-8">
                  No tasks match your filters.
                </TableCell>
              </TableRow>
            )}
            {tasks.map((t) => {
              const visibility = getVisibilityKind(t);
              return (
                <TableRow
                  key={t.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(t)}
                >
                  <TableCell className="text-xs text-muted-foreground">
                    {t.task_number ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate">{t.title}</TableCell>
                  <TableCell>
                    <Badge className={cn('text-[10px] capitalize', STATUS_COLORS[t.status] || '')}>
                      {t.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {visibility === 'public' && (
                      <span className="text-xs text-muted-foreground">Public</span>
                    )}
                    {visibility === 'private' && (
                      <span className="inline-flex items-center gap-1 text-xs text-warning">
                        <Lock className="h-3 w-3" /> Private
                      </span>
                    )}
                    {visibility === 'group' && (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Users className="h-3 w-3" /> Team
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {t.group ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: t.group.color ?? undefined }}
                        />
                        {t.group.name}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{t.owner?.full_name ?? '—'}</TableCell>
                  <TableCell className="text-xs">{t.dept?.name ?? '—'}</TableCell>
                  <TableCell className="text-xs">
                    {t.due_date ? formatDueDate(t.due_date) ?? '—' : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-right">
                    {pushCounts.get(t.id) || 0}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.created_at ? format(new Date(t.created_at), 'd MMM yyyy') : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
