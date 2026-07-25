import { useMemo, useState } from 'react';
import { addDays, format, isSameDay, startOfDay } from 'date-fns';
import { ChevronDown, ChevronRight, Lock, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { isCarryover } from '@/lib/taskCarryover';
import {
  dateKey,
  filterTasksInRange,
  getDateColumns,
  getDefaultWindowStart,
  getTaskState,
  groupTasksByDeptAndOwner,
  isWeekend,
  tasksForCell,
} from '@/lib/taskCalendar';

export interface TaskCalendarViewProps {
  tasks: any[];
  historyIds: Set<string>;
  groupMetaById: Map<string, { name: string; color: string }>;
  departments: Array<{ id: string; name: string }>;
  defaultDays?: 7 | 14 | 28;
  onTaskClick: (task: any) => void;
}

export function TaskCalendarView({
  tasks,
  historyIds,
  groupMetaById,
  departments,
  defaultDays = 14,
  onTaskClick,
}: TaskCalendarViewProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [days, setDays] = useState<7 | 14 | 28>(defaultDays);
  const [windowStart, setWindowStart] = useState<Date>(() =>
    getDefaultWindowStart(new Date(), defaultDays)
  );
  const [collapsedDepts, setCollapsedDepts] = useState<Set<string>>(new Set());
  const [deptFilter, setDeptFilter] = useState<Set<string>>(new Set());

  const columns = useMemo(() => getDateColumns(windowStart, days), [windowStart, days]);

  const inRange = useMemo(() => filterTasksInRange(tasks, columns), [tasks, columns]);

  const grouped = useMemo(() => {
    const filtered = deptFilter.size === 0
      ? inRange
      : inRange.filter((t) => t.department_id && deptFilter.has(t.department_id));
    return groupTasksByDeptAndOwner(filtered);
  }, [inRange, deptFilter]);

  const hasAny = grouped.some((d) => d.owners.some((o) => o.tasks.length > 0));

  const toggleDept = (id: string) => {
    setCollapsedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDeptFilter = (id: string) => {
    setDeptFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // CSS grid: sticky 200px left + N equal columns
  const gridTemplate = `200px repeat(${days}, minmax(56px, 1fr))`;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => setWindowStart((d) => addDays(d, -7))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setWindowStart(getDefaultWindowStart(new Date(), days))}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => setWindowStart((d) => addDays(d, 7))}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Input
            type="date"
            className="h-8 w-[150px] text-xs"
            value={dateKey(windowStart)}
            onChange={(e) => {
              if (e.target.value) setWindowStart(startOfDay(new Date(e.target.value + 'T00:00:00')));
            }}
          />
        </div>

        <Select value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 14 | 28)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7" className="text-xs">7 days</SelectItem>
            <SelectItem value="14" className="text-xs">14 days</SelectItem>
            <SelectItem value="28" className="text-xs">28 days</SelectItem>
          </SelectContent>
        </Select>

        <div className="text-xs text-muted-foreground">
          Showing {days} days from {format(windowStart, 'd MMM')}
        </div>

        {/* Dept multi-select chips */}
        {departments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 ml-auto">
            <span className="text-[10px] uppercase text-muted-foreground">Depts:</span>
            {departments.map((d) => {
              const active = deptFilter.has(d.id);
              return (
                <button
                  key={d.id}
                  onClick={() => toggleDeptFilter(d.id)}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] border transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {d.name}
                </button>
              );
            })}
            {deptFilter.size > 0 && (
              <button
                onClick={() => setDeptFilter(new Set())}
                className="text-[10px] text-muted-foreground underline hover:text-foreground"
              >
                clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grid */}
      {!hasAny ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No tasks in this date range.
        </div>
      ) : (
        <TooltipProvider delayDuration={300}>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            {/* Header */}
            <div
              className="grid sticky top-0 z-10 bg-muted/40 border-b border-border"
              style={{ gridTemplateColumns: gridTemplate }}
            >
              <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground sticky left-0 bg-muted/40 z-10">
                Assignee
              </div>
              {columns.map((d) => {
                const isToday = isSameDay(d, today);
                const weekend = isWeekend(d);
                return (
                  <div
                    key={dateKey(d)}
                    className={cn(
                      'px-1 py-2 text-center border-l border-border text-[10px]',
                      isToday && 'bg-primary text-primary-foreground font-semibold',
                      !isToday && weekend && 'bg-muted/40'
                    )}
                  >
                    <div>{format(d, 'd')}</div>
                    <div className="opacity-80">{format(d, 'EEE')}</div>
                  </div>
                );
              })}
            </div>

            {/* Body */}
            <div>
              {grouped.map((dept) => {
                const collapsed = collapsedDepts.has(dept.deptId);
                const deptTaskCount = dept.owners.reduce((n, o) => n + o.tasks.length, 0);
                if (deptTaskCount === 0) return null;
                return (
                  <div key={dept.deptId}>
                    {/* Dept header row */}
                    <button
                      type="button"
                      onClick={() => toggleDept(dept.deptId)}
                      className="grid w-full text-left bg-muted/20 border-b border-border hover:bg-muted/40 transition-colors"
                      style={{ gridTemplateColumns: gridTemplate }}
                    >
                      <div className="flex items-center gap-1 px-3 py-1.5 sticky left-0 bg-muted/20 z-[1]">
                        {collapsed ? (
                          <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                        <span className="text-xs font-semibold">{dept.deptName}</span>
                        <Badge variant="outline" className="text-[10px] ml-1">
                          {deptTaskCount}
                        </Badge>
                      </div>
                      <div style={{ gridColumn: `span ${days}` }} />
                    </button>

                    {!collapsed &&
                      dept.owners.map((owner) => {
                        if (owner.tasks.length === 0) return null;
                        return (
                          <div
                            key={owner.ownerId}
                            className="grid border-b border-border"
                            style={{ gridTemplateColumns: gridTemplate }}
                            data-testid="calendar-row"
                          >
                            <div className="flex items-center gap-1.5 px-3 py-1.5 sticky left-0 bg-card z-[1] border-r border-border">
                              <span className="text-xs truncate">{owner.ownerName}</span>
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                {dept.deptName}
                              </Badge>
                            </div>
                            {columns.map((d) => {
                              const key = dateKey(d);
                              const cellTasks = tasksForCell(owner, key);
                              const isToday = isSameDay(d, today);
                              const weekend = isWeekend(d);
                              return (
                                <div
                                  key={key}
                                  className={cn(
                                    'border-l border-border min-h-[40px] p-1 flex flex-col items-center justify-start gap-0.5',
                                    isToday && 'bg-primary/10',
                                    !isToday && weekend && 'bg-muted/20'
                                  )}
                                  data-testid="calendar-cell"
                                  data-date={key}
                                >
                                  {cellTasks.slice(0, 3).map((t) => (
                                    <CalendarDot
                                      key={t.id}
                                      task={t}
                                      historyIds={historyIds}
                                      groupMeta={
                                        (t as any).task_group_id
                                          ? groupMetaById.get((t as any).task_group_id)
                                          : undefined
                                      }
                                      onClick={() => onTaskClick(t)}
                                    />
                                  ))}
                                  {cellTasks.length > 3 && (
                                    <button
                                      onClick={() => onTaskClick(cellTasks[3])}
                                      className="text-[9px] text-muted-foreground hover:text-foreground"
                                    >
                                      +{cellTasks.length - 3} more
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}

function CalendarDot({
  task,
  historyIds,
  groupMeta,
  onClick,
}: {
  task: any;
  historyIds: Set<string>;
  groupMeta?: { name: string; color: string };
  onClick: () => void;
}) {
  const today = startOfDay(new Date());
  const state = getTaskState(task, today);
  const carry = isCarryover(task, historyIds);

  const colorClass =
    state === 'overdue'
      ? 'bg-destructive'
      : state === 'today'
      ? 'bg-rag-amber'
      : state === 'closed'
      ? 'bg-muted-foreground/40'
      : 'bg-primary';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={task.title}
          data-testid="calendar-dot"
          data-state={state}
          className={cn(
            'relative h-3.5 w-3.5 rounded-full transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-ring',
            colorClass,
            state === 'closed' && 'line-through'
          )}
          style={
            groupMeta
              ? { boxShadow: `0 0 0 2px ${groupMeta.color}` }
              : undefined
          }
        >
          {task.is_private && (
            <Lock
              className="absolute -right-1 -top-1 h-2.5 w-2.5 text-warning bg-card rounded-full"
              strokeWidth={3}
            />
          )}
          {carry && (
            <span className="absolute -bottom-1 -right-1 text-[8px] leading-none text-violet-600 bg-card rounded-full px-[1px]">
              ↩
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="font-medium">{task.title}</div>
        <div className="text-muted-foreground capitalize">
          {String(task.status || '').replace('_', ' ')} · {task.priority}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
