import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { logAudit } from '@/lib/auditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Loader2, Filter, AlertTriangle, Clock, User,
  ArrowRight, CheckCircle2, XCircle, Pause, Play, ListTodo, Columns3,
  MessageSquare, Calendar as CalendarIcon, Send,
  Pencil, FileText, UserCheck, Lock, Users, Download, CalendarDays,
  Search, X,
} from 'lucide-react';
import { TaskCalendarView } from '@/components/tasks/TaskCalendarView';
import { formatDistanceToNow } from 'date-fns';
import { cn, isTaskOverdue, isTaskDueToday } from '@/lib/utils';
import { filterMyTasks as filterMyTasksFn } from '@/lib/myTasksFilter';
import { sortTasks, formatDueDate, getDueTone, TASK_SORT_OPTIONS, TASK_SORT_STORAGE_KEY, type TaskSortKey } from '@/lib/taskSort';
import { isCarryover, buildPushCountMap, CARRYOVER_FILTER_STORAGE_KEY } from '@/lib/taskCarryover';
import { canUpdateTaskAnyRole, TASK_UPDATE_FORBIDDEN_TOOLTIP } from '@/lib/taskPermissions';
import {
  canCloseTask,
  canChangeDueDate as canChangeDueDateFn,
  canChangeStatus as canChangeStatusFn,
  canEditFields,
  TOOLTIP_CLOSE,
  TOOLTIP_DUE_DATE,
  TOOLTIP_EDIT,
  TOOLTIP_STATUS,
} from '@/lib/taskActionPermissions';
import { formatActivityItem, sortActivityOldestFirst } from '@/lib/taskActivity';
import { taskVisibility, truncateGroupName, shouldWarnOwnerNotInGroup, canPickGroupForTask, GROUP_FILTER_STORAGE_KEY, type VisibilityChoice } from '@/lib/taskGroups';
import { resolveTaskDepartmentId, type UserDeptRow } from '@/lib/taskOwnerResolution';
import { GroupsPanel } from '@/components/tasks/GroupsPanel';
import { searchMatches } from '@/lib/taskSearch';
import { scopeTasksToMyBoard } from '@/lib/taskBoardScope';
import { TaskExportModal } from '@/components/tasks/TaskExportModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Database } from '@/integrations/supabase/types';

type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-rag-amber text-white',
  medium: 'bg-primary/10 text-primary',
  low: 'bg-muted text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-primary/10 text-primary',
  in_progress: 'bg-rag-amber/20 text-warning',
  blocked: 'bg-destructive/10 text-destructive',
  completed: 'bg-rag-green/20 text-success',
  cancelled: 'bg-muted text-muted-foreground',
};

// FIX 6: 5 columns including completed and cancelled
const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'open', label: 'Open' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'completed', label: 'Completed' },
  { status: 'cancelled', label: 'Cancelled' },
];

export default function TaskBoard() {
  const isMobile = useIsMobile();
  const { user, roles, hasAnyRole } = useAuth();
  const isTaskOnly = roles.length === 1 && roles[0] === 'task_only';
  const queryClient = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list' | 'calendar'>(isMobile ? 'list' : 'kanban');
  const [isTablet, setIsTablet] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const onChange = () => setIsTablet(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterMyTasks, setFilterMyTasks] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(true); // FIX 6: default visible
  const [activeListTab, setActiveListTab] = useState<'active' | 'recent'>('active');
  const [chipOverdue, setChipOverdue] = useState(false);
  const [chipDueToday, setChipDueToday] = useState(false);
  const [chipMyTasks, setChipMyTasks] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('fulcrum-mytasks-filter') === '1';
  });
  const [chipCarryover, setChipCarryover] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(CARRYOVER_FILTER_STORAGE_KEY) === '1';
  });
  const [sortKey, setSortKey] = useState<TaskSortKey>(() => {
    if (typeof window === 'undefined') return 'created_desc';
    const v = localStorage.getItem(TASK_SORT_STORAGE_KEY) as TaskSortKey | null;
    return v && TASK_SORT_OPTIONS.some((o) => o.value === v) ? v : 'created_desc';
  });
  const [showGroupsPanel, setShowGroupsPanel] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(GROUP_FILTER_STORAGE_KEY) || null;
  });
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search by 250ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Cmd/Ctrl+K focuses, Escape clears + blurs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchInput('');
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('fulcrum-mytasks-filter', chipMyTasks ? '1' : '0');
  }, [chipMyTasks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TASK_SORT_STORAGE_KEY, sortKey);
  }, [sortKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CARRYOVER_FILTER_STORAGE_KEY, chipCarryover ? '1' : '0');
  }, [chipCarryover]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeGroupFilter) localStorage.setItem(GROUP_FILTER_STORAGE_KEY, activeGroupFilter);
    else localStorage.removeItem(GROUP_FILTER_STORAGE_KEY);
  }, [activeGroupFilter]);

  // Carryover is now derived from task_updates history at render time.
  // The previous effect that set tasks.is_carryover for every overdue task
  // was incorrect (it ignored whether the due date had ever been changed).

  const { data: departments } = useQuery({
    queryKey: ['departments-taskboard'],
    queryFn: async () => {
      const { data } = await supabase.from('department').select('id, name').eq('is_active', true).order('display_order');
      return data || [];
    },
  });

  // FIX 6: Always fetch ALL tasks (never filter out completed/cancelled from query)
  const { data: tasks, isLoading } = useQuery({
    queryKey: ['tasks', filterDept, filterMyTasks, filterPriority],
    queryFn: async () => {
      let q = supabase
        .from('tasks')
        .select('*, owner:profiles!tasks_owner_id_fkey(full_name), dept:department!tasks_department_id_fkey(name), meeting:meetings!tasks_origin_meeting_id_fkey(title, scheduled_date)')
        .order('created_at', { ascending: false });

      if (filterDept !== 'all') q = q.eq('department_id', filterDept);
      if (filterMyTasks && user) q = q.eq('owner_id', user.id);
      if (filterPriority !== 'all') q = q.eq('priority', filterPriority as TaskPriority);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentlyClosed } = useQuery({
    queryKey: ['recently-closed-tasks', filterDept],
    queryFn: async () => {
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
      let q = supabase
        .from('tasks')
        .select('*, owner:profiles!tasks_owner_id_fkey(full_name), dept:department!tasks_department_id_fkey(name)')
        .in('status', ['completed', 'cancelled'])
        .gte('completed_at', twoWeeksAgo.toISOString())
        .order('completed_at', { ascending: false });
      if (filterDept !== 'all') q = q.eq('department_id', filterDept);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: carryoverHistory } = useQuery({
    queryKey: ['task-due-date-change-ids'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_updates')
        .select('task_id')
        .eq('update_type', 'due_date_change');
      if (error) throw error;
      const rows = (data || []) as Array<{ task_id: string }>;
      const ids = new Set(rows.map((r) => r.task_id));
      const counts = buildPushCountMap(rows);
      return { ids, counts };
    },
  });

  // Groups the user is an actual member of — pills are membership-scoped
  // regardless of role. Admins/WM use /admin/tasks for full visibility.
  const { data: myGroups } = useQuery({
    queryKey: ['my-task-groups', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_group_members')
        .select('group:task_groups!task_group_members_group_id_fkey(id, name, color, created_by)')
        .eq('user_id', user!.id);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ group: { id: string; name: string; color: string; created_by: string } | null }>;
      return rows
        .map((r) => r.group)
        .filter((g): g is { id: string; name: string; color: string; created_by: string } => Boolean(g));
    },
    enabled: !!user,
  });

  // Map task_group_id → group meta for card rendering
  const groupMetaById = new Map<string, { name: string; color: string }>(
    (myGroups || []).map((g) => [g.id, { name: g.name, color: g.color }])
  );
  const groupNameById = new Map<string, string>(
    (myGroups || []).map((g) => [g.id, g.name])
  );

  // All tasks (unfiltered) — fetched lazily for export "All tasks" scope
  const { data: allTasksForExport } = useQuery({
    queryKey: ['tasks-all-for-export'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, owner:profiles!tasks_owner_id_fkey(full_name), dept:department!tasks_department_id_fkey(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: showExport,
  });

  // Profiles map for "Assigned By" lookup in export
  const { data: profilesForExport } = useQuery({
    queryKey: ['profiles-for-task-export'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return (data || []) as Array<{ id: string; full_name: string | null }>;
    },
    enabled: showExport,
  });
  const userNameById = new Map<string, string>(
    (profilesForExport || []).map((p) => [p.id, p.full_name ?? '']),
  );

  const historyIds = carryoverHistory?.ids ?? new Set<string>();
  const pushCounts = carryoverHistory?.counts ?? new Map<string, number>();

  // Main-board scoping — uniform for ALL roles incl. super_admin/factory_manager.
  // Admin/WM use /admin/tasks for full visibility; the main /tasks board shows
  // only tasks the viewer is involved in (public, owned, created, or in their groups).
  const myGroupIdSetForScope = new Set((myGroups || []).map((g) => g.id));
  const scopedTasks = scopeTasksToMyBoard(tasks, user?.id, myGroupIdSetForScope);
  const scopedRecentlyClosed = scopeTasksToMyBoard(recentlyClosed, user?.id, myGroupIdSetForScope);

  const overdueCount = scopedTasks.filter(isTaskOverdue).length;
  const dueTodayCount = scopedTasks.filter(isTaskDueToday).length;
  const myTasksCount = filterMyTasksFn(scopedTasks, user?.id).length;
  const carryoverCount = scopedTasks.filter((t) => isCarryover(t, historyIds)).length;

  const applyChipFilters = (list: any[]) => {
    let result = list;
    if (chipMyTasks && user) result = filterMyTasksFn(result, user.id);
    if (chipOverdue) result = result.filter(isTaskOverdue);
    if (chipDueToday) result = result.filter(isTaskDueToday);
    if (chipCarryover) result = result.filter((t) => isCarryover(t, historyIds));
    if (activeGroupFilter) result = result.filter((t) => (t as any).task_group_id === activeGroupFilter);
    if (debouncedSearch.trim()) {
      result = result.filter((t) =>
        searchMatches(
          {
            ...t,
            group: (t as any).task_group_id
              ? { name: groupNameById.get((t as any).task_group_id) }
              : undefined,
          },
          debouncedSearch,
        ),
      );
    }
    return result;
  };

  const activeTasks = sortTasks(applyChipFilters(scopedTasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled')), sortKey);
  const completedTasks = sortTasks(applyChipFilters(scopedTasks.filter((t) => t.status === 'completed')), sortKey);
  const cancelledTasks = sortTasks(applyChipFilters(scopedTasks.filter((t) => t.status === 'cancelled')), sortKey);
  const totalAfterFilters = activeTasks.length + completedTasks.length + cancelledTasks.length;
  const searchActive = debouncedSearch.trim().length > 0;
  const noSearchResults = searchActive && totalAfterFilters === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">Task Board</h1>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {!isMobile && (
            <div className="flex border rounded-md overflow-hidden">
              <Button size="sm" variant={view === 'kanban' ? 'default' : 'ghost'} className="h-8 rounded-none gap-1" onClick={() => setView('kanban')}>
                <Columns3 className="h-3.5 w-3.5" /> Kanban
              </Button>
              <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} className="h-8 rounded-none gap-1" onClick={() => setView('list')}>
                <ListTodo className="h-3.5 w-3.5" /> List
              </Button>
              <Button
                size="sm"
                variant={view === 'calendar' ? 'default' : 'ghost'}
                className="h-8 rounded-none gap-1"
                onClick={() => {
                  if (isMobile) {
                    toast({ title: 'Calendar view is best on desktop. Try Kanban or List view.' });
                    return;
                  }
                  setView('calendar');
                }}
              >
                <CalendarDays className="h-3.5 w-3.5" /> Calendar
              </Button>
            </div>
          )}
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as TaskSortKey)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasAnyRole('super_admin', 'factory_manager') && (
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setShowExport(true)}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3.5 w-3.5" /> Filters
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setShowGroupsPanel(true)}>
            <Users className="h-3.5 w-3.5" /> Groups
          </Button>
          {isMobile ? (
            <Button
              onClick={() => setShowCreate(true)}
              className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg p-0"
              aria-label="New Task"
            >
              <Plus className="h-6 w-6" />
            </Button>
          ) : (
            <Button onClick={() => setShowCreate(true)} className="h-8 gap-1 text-sm">
              <Plus className="h-3.5 w-3.5" /> New Task
            </Button>
          )}
        </div>
      </div>

      <Collapsible open={showFilters}>
        <CollapsibleContent>
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {!isTaskOnly && (
                  <div>
                    <Label className="text-xs">Department</Label>
                    <Select value={filterDept} onValueChange={setFilterDept}>
                      <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 justify-end">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch checked={filterMyTasks} onCheckedChange={setFilterMyTasks} className="scale-75" /> My Tasks Only
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Switch checked={showCompleted} onCheckedChange={setShowCompleted} className="scale-75" /> Show Completed
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Search */}
      <div className="relative w-full sm:w-[280px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={searchInputRef}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search tasks by title, owner, or #number"
          aria-label="Search tasks"
          data-testid="task-search-input"
          className="h-8 pl-8 pr-8 text-xs"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput('');
              searchInputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setChipOverdue(!chipOverdue)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
            chipOverdue
              ? 'bg-destructive text-destructive-foreground border-destructive'
              : 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20'
          )}
        >
          <AlertTriangle className="h-3 w-3" /> Overdue ({overdueCount})
        </button>
        <button
          onClick={() => setChipDueToday(!chipDueToday)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
            chipDueToday
              ? 'bg-rag-amber text-white border-rag-amber'
              : 'bg-rag-amber/10 text-warning border-rag-amber/30 hover:bg-rag-amber/20'
          )}
        >
          <Clock className="h-3 w-3" /> Due Today ({dueTodayCount})
        </button>
        <button
          onClick={() => setChipMyTasks(!chipMyTasks)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
            chipMyTasks
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
          )}
        >
          <User className="h-3 w-3" /> My Tasks ({myTasksCount})
        </button>
        <button
          onClick={() => setChipCarryover(!chipCarryover)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors',
            chipCarryover
              ? 'bg-violet-600 text-white border-violet-600'
              : 'bg-violet-500/10 text-violet-600 border-violet-500/40 hover:bg-violet-500/20 dark:text-violet-300'
          )}
        >
          <CalendarIcon className="h-3 w-3" /> Carryover ({carryoverCount})
        </button>
      </div>

      {(myGroups && myGroups.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Groups:</span>
          {myGroups.map((g) => {
            const active = activeGroupFilter === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setActiveGroupFilter(active ? null : g.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors',
                  active ? 'text-white' : 'hover:opacity-80'
                )}
                style={
                  active
                    ? { backgroundColor: g.color, borderColor: g.color }
                    : { color: g.color, borderColor: g.color, backgroundColor: 'transparent' }
                }
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: active ? '#fff' : g.color }}
                />
                {truncateGroupName(g.name, 16)}
              </button>
            );
          })}
          {activeGroupFilter && (
            <button
              onClick={() => setActiveGroupFilter(null)}
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
            >
              clear
            </button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : noSearchResults ? (
        <div
          className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
          data-testid="task-search-empty"
        >
          No tasks match "{debouncedSearch.trim()}"
        </div>
      ) : view === 'kanban' && !isMobile ? (
        /* FIX 6: Kanban with 5 columns, completed/cancelled controlled by toggle */
        <div className={cn('grid gap-3', showCompleted ? 'grid-cols-5' : 'grid-cols-3')}>
          {COLUMNS.filter((col) => {
            if (!showCompleted && (col.status === 'completed' || col.status === 'cancelled')) return false;
            return true;
          }).map((col) => {
            let colTasks: any[];
            if (col.status === 'completed') colTasks = completedTasks;
            else if (col.status === 'cancelled') colTasks = cancelledTasks;
            else colTasks = activeTasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.label}</h3>
                  <Badge variant="secondary" className="text-[10px]">{colTasks.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px] bg-muted/20 rounded-lg p-2">
                  {colTasks.map((task) => (
                    <KanbanCard key={task.id} task={task} historyIds={historyIds} pushCounts={pushCounts} groupMeta={task.task_group_id ? groupMetaById.get(task.task_group_id) : undefined} onClick={() => setSelectedTask(task)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : view === 'calendar' && !isMobile ? (
        <TaskCalendarView
          tasks={[...activeTasks, ...completedTasks, ...cancelledTasks]}
          historyIds={historyIds}
          groupMetaById={groupMetaById}
          departments={departments || []}
          defaultDays={isTablet ? 7 : 14}
          onTaskClick={setSelectedTask}
        />
      ) : (
        <Tabs value={activeListTab} onValueChange={(v) => setActiveListTab(v as any)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="active" className="text-xs">Active ({activeTasks.length})</TabsTrigger>
            <TabsTrigger value="recent" className="text-xs">Recently Closed ({scopedRecentlyClosed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-3 space-y-2">
            {activeTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active tasks.</p>
            ) : (
              activeTasks.map((task) => (
                <TaskListCard key={task.id} task={task} historyIds={historyIds} pushCounts={pushCounts} groupMeta={task.task_group_id ? groupMetaById.get(task.task_group_id) : undefined} onClick={() => setSelectedTask(task)} />
              ))
            )}
          </TabsContent>
          <TabsContent value="recent" className="mt-3 space-y-2">
            {!scopedRecentlyClosed.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recently closed tasks.</p>
            ) : (
              scopedRecentlyClosed.map((task) => (
                <TaskListCard key={task.id} task={task} historyIds={historyIds} pushCounts={pushCounts} groupMeta={task.task_group_id ? groupMetaById.get(task.task_group_id) : undefined} onClick={() => setSelectedTask(task)} readOnly />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      {selectedTask && <TaskDetailDrawer task={selectedTask} open={!!selectedTask} onOpenChange={(v) => !v && setSelectedTask(null)} />}
      {showCreate && <CreateTaskModal open={showCreate} onOpenChange={setShowCreate} myGroups={myGroups || []} />}
      <GroupsPanel open={showGroupsPanel} onOpenChange={setShowGroupsPanel} />
      <TaskExportModal
        open={showExport}
        onOpenChange={setShowExport}
        currentViewTasks={[...activeTasks, ...completedTasks, ...cancelledTasks]}
        allTasks={allTasksForExport || tasks || []}
        pushCounts={pushCounts}
        groupNameById={groupNameById}
        userNameById={userNameById}
      />
    </div>
  );
}

function KanbanCard({ task, historyIds, pushCounts, groupMeta, onClick }: { task: any; historyIds: Set<string>; pushCounts: Map<string, number>; groupMeta?: { name: string; color: string }; onClick: () => void }) {
  const isClosed = ['completed', 'cancelled'].includes(task.status);
  const isOverdue = !isClosed && task.due_date && new Date(task.due_date) < new Date();
  const dueText = !isClosed ? formatDueDate(task.due_date) : null;
  const dueTone = !isClosed ? getDueTone(task.due_date) : null;
  const dueClass =
    dueTone === 'overdue' ? 'text-destructive' :
    dueTone === 'today' ? 'text-rag-amber' :
    'text-muted-foreground';
  const carryover = isCarryover(task, historyIds);
  const pushes = pushCounts.get(task.id) ?? 0;
  return (
    <Card
      className={cn('cursor-pointer hover:shadow-md transition-shadow', isOverdue && 'border-destructive/30')}
      style={groupMeta ? { borderLeft: `3px solid ${groupMeta.color}` } : undefined}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-muted-foreground">#{task.task_number}</span>
            <p className="text-sm font-medium leading-tight truncate flex items-center gap-1">
              {task.is_private && !groupMeta && <Lock size={12} className="shrink-0 text-muted-foreground" aria-label="Private task" />}
              <span className="truncate">{task.title}</span>
            </p>
            {groupMeta && (
              <span
                className="inline-flex items-center gap-1 mt-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ color: groupMeta.color, border: `1px solid ${groupMeta.color}40`, backgroundColor: `${groupMeta.color}15` }}
                title={groupMeta.name}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: groupMeta.color }} />
                {truncateGroupName(groupMeta.name)}
              </span>
            )}
          </div>
          <Badge className={cn('text-[10px] shrink-0', PRIORITY_COLORS[task.priority])}>{task.priority}</Badge>
        </div>
        {dueText && (
          <p className={cn('text-[10px] flex items-center gap-1', dueClass)}>
            <CalendarIcon className="h-3 w-3" /> {dueText}
          </p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{(task as any).owner?.full_name}</span>
          {(task as any).dept?.name && <Badge variant="secondary" className="text-[10px]">{(task as any).dept.name}</Badge>}
        </div>
        {(carryover || pushes >= 1) && (
          <div className="flex items-center gap-1 flex-wrap">
            {carryover && (
              <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-600 dark:text-violet-300">
                ↩ Carryover
              </Badge>
            )}
            {pushes >= 1 && (
              <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-600 dark:text-violet-300">
                ↩ {pushes}×
              </Badge>
            )}
          </div>
        )}
        {(task as any).meeting && <span className="text-[10px] text-muted-foreground">Meeting: {(task as any).meeting.title}</span>}
      </CardContent>
    </Card>
  );
}

function TaskListCard({ task, historyIds, pushCounts, groupMeta, onClick, readOnly }: { task: any; historyIds: Set<string>; pushCounts: Map<string, number>; groupMeta?: { name: string; color: string }; onClick?: () => void; readOnly?: boolean }) {
  const isOverdue = !['completed', 'cancelled'].includes(task.status) && new Date(task.due_date) < new Date();
  const carryover = isCarryover(task, historyIds);
  const pushes = pushCounts.get(task.id) ?? 0;
  return (
    <Card
      className={cn('cursor-pointer active:bg-muted/50', isOverdue && 'border-destructive/30')}
      style={groupMeta ? { borderLeft: `3px solid ${groupMeta.color}` } : undefined}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{task.task_number}</span>
              {task.is_private && !groupMeta && <Lock size={12} className="shrink-0 text-muted-foreground" aria-label="Private task" />}
              <p className="text-sm font-medium truncate">{task.title}</p>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {groupMeta && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ color: groupMeta.color, border: `1px solid ${groupMeta.color}40`, backgroundColor: `${groupMeta.color}15` }}
                  title={groupMeta.name}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: groupMeta.color }} />
                  {truncateGroupName(groupMeta.name)}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{(task as any).owner?.full_name}</span>
              {(task as any).dept?.name && <Badge variant="secondary" className="text-[10px]">{(task as any).dept.name}</Badge>}
              {isOverdue && <span className="text-[10px] text-destructive">{Math.ceil(differenceInDays(new Date(), new Date(task.due_date)))}d overdue</span>}
              {carryover && (
                <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-600 dark:text-violet-300">
                  ↩ Carryover
                </Badge>
              )}
              {pushes >= 1 && (
                <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-600 dark:text-violet-300">
                  ↩ {pushes}×
                </Badge>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Badge className={cn('text-[10px]', STATUS_COLORS[task.status])}>{task.status.replace('_', ' ')}</Badge>
            <Badge className={cn('text-[10px]', PRIORITY_COLORS[task.priority])}>{task.priority}</Badge>
          </div>
        </div>
        {readOnly && task.resolution_note && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{task.resolution_note}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TaskDetailDrawer({ task, open, onOpenChange }: { task: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const isMobile = useIsMobile();
  const { user, hasAnyRole, roles } = useAuth();
  const isTaskOnly = roles.length === 1 && roles[0] === 'task_only';
  const queryClient = useQueryClient();
  const [resolutionNote, setResolutionNote] = useState('');
  const [updateNote, setUpdateNote] = useState('');
  const [showDueDateChange, setShowDueDateChange] = useState(false);
  const [newDueDate, setNewDueDate] = useState('');
  const [dueDateReason, setDueDateReason] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDeptId, setEditDeptId] = useState('');
  const [editOwnerId, setEditOwnerId] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  // Note: due date and is_private are NOT editable from Edit Task form.
  // Due date is changed via the separate "Change Due Date" control (update_task_due_date RPC).

  const today = format(new Date(), 'yyyy-MM-dd');

  // Fetch user's department membership + leader-of group memberships,
  // so we can compute action permissions matching the new DB rules.
  const { data: userDeptIds = [] } = useQuery({
    queryKey: ['user-dept-ids', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user!.id);
      return (data || []).map((r: any) => r.department_id as string);
    },
  });

  const { data: leaderGroupIds = [] } = useQuery({
    queryKey: ['user-leader-groups', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const client = supabase as any;
      const { data } = await client
        .from('task_group_members')
        .select('group_id, is_leader')
        .eq('user_id', user!.id)
        .eq('is_leader', true);
      return ((data as any[]) || []).map((r: any) => r.group_id as string);
    },
  });

  const permCtx = {
    userId: user?.id || '',
    roles: roles as string[],
    userDepartmentIds: userDeptIds,
    leaderGroupIds,
  };

  const { data: freshTask } = useQuery({
    queryKey: ['task-detail', task.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tasks')
        .select('*, owner:profiles!tasks_owner_id_fkey(full_name), dept:department!tasks_department_id_fkey(name), assignedBy:profiles!tasks_assigned_by_fkey(full_name), meeting:meetings!tasks_origin_meeting_id_fkey(id, title, scheduled_date)')
        .eq('id', task.id)
        .single();
      return data;
    },
  });

  const { data: editDepartments } = useQuery({
    queryKey: ['departments-edit-task'],
    queryFn: async () => {
      const { data } = await supabase.from('department').select('id, name').eq('is_active', true).order('display_order');
      return data || [];
    },
    enabled: editMode,
  });

  const editTaskGroupId: string | null = (freshTask as any)?.task_group_id ?? (task as any)?.task_group_id ?? null;
  const editIsGroupTask = !!editTaskGroupId;

  const { data: editGroupMemberProfiles } = useQuery({
    queryKey: ['edit-task-group-member-profiles', editTaskGroupId],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('task_group_members')
        .select('user_id')
        .eq('group_id', editTaskGroupId as string);
      const ids = (rows || []).map((r) => r.user_id as string);
      if (!ids.length) return [] as { id: string; full_name: string }[];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)
        .eq('is_active', true);
      return (data || []) as { id: string; full_name: string }[];
    },
    enabled: editMode && editIsGroupTask,
  });

  const editGroupMemberIdList = (editGroupMemberProfiles || []).map((p) => p.id);
  const { data: editGroupMemberDepts } = useQuery({
    queryKey: ['edit-task-group-member-depts', editGroupMemberIdList.sort().join(',')],
    queryFn: async () => {
      if (!editGroupMemberIdList.length) return [] as UserDeptRow[];
      const { data } = await supabase
        .from('user_departments')
        .select('user_id, department_id, is_primary')
        .in('user_id', editGroupMemberIdList);
      return (data || []) as UserDeptRow[];
    },
    enabled: editMode && editIsGroupTask && editGroupMemberIdList.length > 0,
  });
  const { data: editCreatorDepts } = useQuery({
    queryKey: ['edit-task-creator-depts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as UserDeptRow[];
      const { data } = await supabase
        .from('user_departments')
        .select('user_id, department_id, is_primary')
        .eq('user_id', user.id);
      return (data || []) as UserDeptRow[];
    },
    enabled: editMode && editIsGroupTask && !!user?.id,
  });

  const { data: editDeptUsers } = useQuery({
    queryKey: ['dept-users-edit-task', editDeptId],
    queryFn: async () => {
      const { data: uds } = await supabase.from('user_departments').select('user_id').eq('department_id', editDeptId);
      if (!uds?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', uds.map((u) => u.user_id)).eq('is_active', true);
      return data || [];
    },
    enabled: !!editDeptId && editMode && !editIsGroupTask,
  });

  const { data: statusHistory } = useQuery({
    queryKey: ['task-updates', task.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('task_updates')
        .select('*, updater:profiles!task_updates_updated_by_fkey(full_name)')
        .eq('task_id', task.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const changeStatusMutation = useMutation({
    mutationFn: async ({ newStatus, note }: { newStatus: TaskStatus; note?: string }) => {
      const { error } = await supabase.rpc('update_task_status' as any, {
        p_task_id: task.id,
        p_new_status: newStatus,
        p_note: note || updateNote || null,
      });
      if (error) throw error;

      if (newStatus === 'completed' || newStatus === 'cancelled') {
        const { error: resErr } = await supabase
          .from('tasks')
          .update({ resolution_note: note || resolutionNote, completed_at: new Date().toISOString() })
          .eq('id', task.id);
        if (resErr) throw resErr;
      }
    },
    onSuccess: (_, vars) => {
      toast({ title: 'Status updated' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-detail', task.id] });
      queryClient.invalidateQueries({ queryKey: ['task-updates', task.id] });
      queryClient.invalidateQueries({ queryKey: ['recently-closed-tasks'] });
      setResolutionNote('');
      setUpdateNote('');
      logAudit('tasks', task.id, 'UPDATE', { status: freshTask?.status || task.status }, { status: vars.newStatus });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const changeDueDateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('update_task_due_date' as any, {
        p_task_id: task.id,
        p_new_due_date: newDueDate,
        p_reason: dueDateReason || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Due date changed' });
      queryClient.invalidateQueries({ queryKey: ['task-detail', task.id] });
      queryClient.invalidateQueries({ queryKey: ['task-updates', task.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowDueDateChange(false);
      setNewDueDate('');
      setDueDateReason('');
      logAudit('tasks', task.id, 'UPDATE', { due_date: freshTask?.due_date || task.due_date }, { due_date: newDueDate });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addCommentMutation = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.from('task_updates').insert({
        task_id: task.id,
        updated_by: user!.id,
        update_type: 'comment',
        update_note: text,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-updates', task.id] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const editDerivedDeptId = editIsGroupTask
    ? resolveTaskDepartmentId({
        ownerId: editOwnerId,
        ownerDeptRows: editGroupMemberDepts ?? [],
        creatorId: user?.id ?? null,
        creatorDeptRows: editCreatorDepts ?? [],
      })
    : null;
  const effectiveEditDeptId = editIsGroupTask ? (editDerivedDeptId ?? '') : editDeptId;
  const editOwnerOptions = editIsGroupTask
    ? (editGroupMemberProfiles || [])
    : (editDeptUsers || []);
  const editDerivedDeptName = editIsGroupTask && editDerivedDeptId
    ? (editDepartments?.find((d) => d.id === editDerivedDeptId)?.name ?? '—')
    : '';

  const editTaskMutation = useMutation({
    mutationFn: async () => {
      if (editIsGroupTask && !effectiveEditDeptId) {
        throw new Error('Cannot derive a department for this owner');
      }
      const oldValues = {
        title: t.title,
        description: t.description,
        department_id: t.department_id,
        owner_id: t.owner_id,
        priority: t.priority,
      };
      // Use RPC — direct table updates are blocked for HODs/owners.
      // RPC also logs title/assignee changes to task_updates internally.
      const { error } = await supabase.rpc('update_task_fields' as any, {
        p_task_id: task.id,
        p_title: editTitle,
        p_description: editDescription || null,
        p_owner_id: editOwnerId,
        p_priority: editPriority,
        p_department_id: effectiveEditDeptId,
      });
      if (error) throw error;
      logAudit('tasks', task.id, 'UPDATE', oldValues, {
        title: editTitle,
        description: editDescription,
        department_id: effectiveEditDeptId,
        owner_id: editOwnerId,
        priority: editPriority,
      });
    },
    onSuccess: () => {
      toast({ title: 'Task updated' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-detail', task.id] });
      queryClient.invalidateQueries({ queryKey: ['task-updates', task.id] });
      setEditMode(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });


  const enterEditMode = () => {
    const t = freshTask || task;
    setEditTitle(t.title);
    setEditDescription(t.description || '');
    setEditDeptId(t.department_id);
    setEditOwnerId(t.owner_id);
    setEditPriority(t.priority);
    setEditDueDate(t.due_date);
    setEditIsPrivate(!!(t as any).is_private);
    setEditMode(true);
  };

  const t = freshTask || task;
  const isTerminal = t.status === 'completed' || t.status === 'cancelled';
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completingAs, setCompletingAs] = useState<TaskStatus>('completed');

  const content = editMode ? (
    <div className="space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">Edit Task #{t.task_number}</h2>
      </div>
      <div><Label>Title *</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-11 mt-1" /></div>
      <div><Label>Description</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2} className="mt-1" /></div>
      <div>
        <Label>Department *</Label>
        {editIsGroupTask ? (
          <div className="h-11 mt-1 flex items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
            {editDerivedDeptName || 'Auto from owner'}
          </div>
        ) : (
          <Select value={editDeptId} onValueChange={(v) => { setEditDeptId(v); setEditOwnerId(''); }}>
            <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{editDepartments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label>Owner *</Label>
        <Select value={editOwnerId} onValueChange={setEditOwnerId}>
          <SelectTrigger className="h-11 mt-1"><SelectValue placeholder={editIsGroupTask ? 'Select group member' : 'Select'} /></SelectTrigger>
          <SelectContent>{editOwnerOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Priority</Label>
          <Select value={editPriority} onValueChange={(v) => setEditPriority(v as TaskPriority)}>
            <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem><SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Due Date *</Label><Input type="date" min={today} value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="h-11 mt-1" /></div>
      </div>
      <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="edit-private-toggle" className="text-sm">Private task</Label>
          <p className="text-xs text-muted-foreground">Only you and the assignee will see this task</p>
        </div>
        <Switch id="edit-private-toggle" checked={editIsPrivate} onCheckedChange={setEditIsPrivate} />
      </div>
      <div className="flex gap-2">
        <Button onClick={() => editTaskMutation.mutate()} disabled={!editTitle || !effectiveEditDeptId || !editOwnerId || !editDueDate || editTaskMutation.isPending} className="flex-1 h-11">
          {editTaskMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save
        </Button>
        <Button variant="outline" onClick={() => setEditMode(false)} className="h-11">Cancel</Button>
      </div>
    </div>
  ) : (
    <div className="space-y-6 pb-6">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">#{t.task_number}</span>
          <Badge className={cn('text-[10px]', STATUS_COLORS[t.status])}>{t.status.replace('_', ' ')}</Badge>
          <Badge className={cn('text-[10px]', PRIORITY_COLORS[t.priority])}>{t.priority}</Badge>
        </div>
        <div className="flex items-center justify-between mt-1">
          <h2 className="text-base font-bold">{t.title}</h2>
          {canEditFields(t as any, permCtx) && !isTerminal && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={enterEditMode}>
              Edit Task
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-2 text-sm">
        <div><span className="text-muted-foreground text-xs">Department</span><p>{(t as any).dept?.name || '—'}</p></div>
        <div><span className="text-muted-foreground text-xs">Owner</span><p>{(t as any).owner?.full_name || '—'}</p></div>
        <div><span className="text-muted-foreground text-xs">Assigned by</span><p>{(t as any).assignedBy?.full_name || '—'}</p></div>
        <div>
          <span className="text-muted-foreground text-xs">Due Date</span>
          <p className={cn(new Date(t.due_date) < new Date() && !isTerminal && 'text-destructive font-medium')}>
            {format(new Date(t.due_date), 'dd MMM yyyy')}
          </p>
        </div>
      </div>

      {!isTerminal && canChangeDueDateFn(t as any, permCtx) && (
        <div>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setShowDueDateChange(!showDueDateChange)}>Change Due Date</Button>
          {showDueDateChange && (
            <div className="mt-2 space-y-2 border rounded-lg p-3 bg-muted/30">
              <Input type="date" min={today} value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} className="h-10" />
              <Input value={dueDateReason} onChange={(e) => setDueDateReason(e.target.value)} placeholder="Reason for change (required)" className="h-10" />
              <Button size="sm" onClick={() => changeDueDateMutation.mutate()} disabled={!newDueDate || !dueDateReason || changeDueDateMutation.isPending} className="h-9">Update</Button>
            </div>
          )}
        </div>
      )}

      {t.description && (
        <div>
          <span className="text-muted-foreground text-xs">Description</span>
          <p className="text-sm mt-0.5">{t.description}</p>
        </div>
      )}

      {!isTerminal && (() => {
        const canStatus = canChangeStatusFn(t as any, permCtx);
        const canClose = canCloseTask(t as any, permCtx);
        const onSelectStatus = (newStatus: TaskStatus) => {
          if (newStatus === t.status) return;
          if (newStatus === 'completed' || newStatus === 'cancelled') {
            if (!canClose) return;
            setCompletingAs(newStatus);
            setShowCompleteDialog(true);
            return;
          }
          if (!canStatus) return;
          changeStatusMutation.mutate({ newStatus });
        };
        return (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</h3>

            {/* Status dropdown — allows changing in any direction */}
            <div className="space-y-1">
              <Label className="text-xs">Change Status</Label>
              {canStatus ? (
                <Select value={t.status} onValueChange={(v) => onSelectStatus(v as TaskStatus)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="completed" disabled={!canClose}>Completed</SelectItem>
                    <SelectItem value="cancelled" disabled={!canClose}>Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Select value={t.status} disabled>
                          <SelectTrigger className="h-10 opacity-60 cursor-not-allowed"><SelectValue /></SelectTrigger>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{TOOLTIP_STATUS}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Quick action buttons */}
            <div className="flex flex-wrap gap-2">
              {t.status === 'open' && (
                <>
                  {canStatus && (
                    <Button size="sm" className="h-10 gap-1" onClick={() => changeStatusMutation.mutate({ newStatus: 'in_progress' })}>
                      <Play className="h-3.5 w-3.5" /> Start Work
                    </Button>
                  )}
                  {canClose && (
                    <Button size="sm" variant="outline" className="h-10 gap-1" onClick={() => { setCompletingAs('cancelled'); setShowCompleteDialog(true); }}>
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  )}
                </>
              )}
              {t.status === 'in_progress' && (
                <>
                  {canStatus && (
                    <Button size="sm" variant="outline" className="h-10 gap-1" onClick={() => changeStatusMutation.mutate({ newStatus: 'blocked' })}>
                      <Pause className="h-3.5 w-3.5" /> Mark Blocked
                    </Button>
                  )}
                  {canClose && (
                    <Button size="sm" className="h-10 gap-1 bg-rag-green hover:bg-rag-green/90 text-white" onClick={() => { setCompletingAs('completed'); setShowCompleteDialog(true); }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </Button>
                  )}
                </>
              )}
              {t.status === 'blocked' && (
                <>
                  {canStatus && (
                    <Button size="sm" className="h-10 gap-1" onClick={() => changeStatusMutation.mutate({ newStatus: 'in_progress' })}>
                      <Play className="h-3.5 w-3.5" /> Resume
                    </Button>
                  )}
                  {canClose && (
                    <Button size="sm" className="h-10 gap-1 bg-rag-green hover:bg-rag-green/90 text-white" onClick={() => { setCompletingAs('completed'); setShowCompleteDialog(true); }}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </Button>
                  )}
                </>
              )}
            </div>
            {!canClose && canStatus && (
              <p className="text-xs text-muted-foreground italic">{TOOLTIP_CLOSE}</p>
            )}
          </div>
        );
      })()}

      {isTerminal && t.resolution_note && (
        <div>
          <span className="text-muted-foreground text-xs">Resolution Note</span>
          <p className="text-sm mt-0.5">{t.resolution_note}</p>
        </div>
      )}

      {(t as any).meeting && !isTaskOnly && (
        <div>
          <span className="text-muted-foreground text-xs">Origin</span>
          <p className="text-sm">Created in: <a href={`/meetings/${(t as any).meeting.id}/workspace`} className="text-primary underline">{(t as any).meeting.title} ({format(new Date((t as any).meeting.scheduled_date), 'dd MMM')})</a></p>
        </div>
      )}

      <ActivityFeed
        items={statusHistory || []}
        onAddComment={(text) => addCommentMutation.mutate(text)}
        isAdding={addCommentMutation.isPending}
      />

      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{completingAs === 'completed' ? 'Complete Task' : 'Cancel Task'}</DialogTitle></DialogHeader>
          <div>
            <Label>Resolution Note *</Label>
            <Textarea value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="What was done / why cancelled?" rows={3} className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>Back</Button>
            <Button
              onClick={() => { changeStatusMutation.mutate({ newStatus: completingAs, note: resolutionNote }); setShowCompleteDialog(false); }}
              disabled={!resolutionNote}
              className={completingAs === 'completed' ? 'bg-rag-green hover:bg-rag-green/90 text-white' : ''}
            >
              {completingAs === 'completed' ? 'Complete' : 'Cancel Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          <SheetHeader><SheetTitle className="sr-only">Task Detail</SheetTitle></SheetHeader>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader><SheetTitle className="sr-only">Task Detail</SheetTitle></SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  );
}

function CreateTaskModal({ open, onOpenChange, myGroups }: { open: boolean; onOpenChange: (v: boolean) => void; myGroups: Array<{ id: string; name: string; color: string; created_by?: string }> }) {
  const { user, roles } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deptId, setDeptId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [visibility, setVisibility] = useState<VisibilityChoice>('everyone');
  const today = format(new Date(), 'yyyy-MM-dd');

  // Groups the current user belongs to — drives which groups appear
  // in the "Visible to" selector for non-admin roles.
  const { data: myMemberships } = useQuery({
    queryKey: ['my-group-memberships', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data } = await supabase
        .from('task_group_members')
        .select('group_id')
        .eq('user_id', user.id);
      return ((data || []) as Array<{ group_id: string }>).map((r) => r.group_id);
    },
    enabled: open && !!user?.id,
  });
  const myGroupIdSet = new Set(myMemberships || []);
  const pickableGroups = (myGroups || []).filter((g) =>
    canPickGroupForTask(
      { id: g.id, created_by: g.created_by ?? '' },
      user?.id ?? null,
      roles as string[],
      myGroupIdSet,
    ),
  );

  const { data: departments } = useQuery({
    queryKey: ['departments-create-task'],
    queryFn: async () => {
      const { data } = await supabase.from('department').select('id, name').eq('is_active', true).order('display_order');
      return data || [];
    },
    enabled: open,
  });

  const { data: deptUsers } = useQuery({
    queryKey: ['dept-users-create-task', deptId],
    queryFn: async () => {
      const { data: uds } = await supabase.from('user_departments').select('user_id').eq('department_id', deptId);
      if (!uds?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', uds.map((u) => u.user_id)).eq('is_active', true);
      return data || [];
    },
    enabled: !!deptId,
  });

  // Fetch members (with profiles) of selected visibility group
  const isGroupVisibility = visibility !== 'everyone' && visibility !== 'private';
  const { data: groupMemberProfiles } = useQuery({
    queryKey: ['create-task-group-member-profiles', visibility],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('task_group_members')
        .select('user_id')
        .eq('group_id', visibility as string);
      const ids = (rows || []).map((r) => r.user_id as string);
      if (!ids.length) return [] as { id: string; full_name: string }[];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ids)
        .eq('is_active', true);
      return (data || []) as { id: string; full_name: string }[];
    },
    enabled: open && isGroupVisibility,
  });
  const groupMemberIds = isGroupVisibility
    ? new Set((groupMemberProfiles || []).map((p) => p.id))
    : null;

  // Departments for: every group member (to derive task department from owner)
  // and the creator (fallback when owner has no department).
  const groupMemberIdList = (groupMemberProfiles || []).map((p) => p.id);
  const { data: groupMemberDepts } = useQuery({
    queryKey: ['create-task-group-member-depts', groupMemberIdList.sort().join(',')],
    queryFn: async () => {
      if (!groupMemberIdList.length) return [] as UserDeptRow[];
      const { data } = await supabase
        .from('user_departments')
        .select('user_id, department_id, is_primary')
        .in('user_id', groupMemberIdList);
      return (data || []) as UserDeptRow[];
    },
    enabled: open && isGroupVisibility && groupMemberIdList.length > 0,
  });
  const { data: creatorDepts } = useQuery({
    queryKey: ['create-task-creator-depts', user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as UserDeptRow[];
      const { data } = await supabase
        .from('user_departments')
        .select('user_id, department_id, is_primary')
        .eq('user_id', user.id);
      return (data || []) as UserDeptRow[];
    },
    enabled: open && !!user?.id,
  });

  const derivedDeptId = isGroupVisibility
    ? resolveTaskDepartmentId({
        ownerId,
        ownerDeptRows: groupMemberDepts ?? [],
        creatorId: user?.id ?? null,
        creatorDeptRows: creatorDepts ?? [],
      })
    : null;
  const effectiveDeptId = isGroupVisibility ? (derivedDeptId ?? '') : deptId;
  const derivedDeptName = isGroupVisibility && derivedDeptId
    ? (departments?.find((d) => d.id === derivedDeptId)?.name ?? '—')
    : '';

  const showOwnerNotInGroupWarning = shouldWarnOwnerNotInGroup(visibility, ownerId, groupMemberIds);
  const selectedGroup = isGroupVisibility ? myGroups.find((g) => g.id === visibility) : null;
  const ownerOptions = isGroupVisibility
    ? (groupMemberProfiles || [])
    : (deptUsers || []);
  const ownerName = ownerOptions.find((u) => u.id === ownerId)?.full_name || 'The assignee';

  // Reset owner when visibility mode flips between dept-driven and group-driven
  useEffect(() => {
    setOwnerId('');
  }, [isGroupVisibility, visibility]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (dueDate < today) throw new Error('Due date cannot be in the past');
      const vis = taskVisibility(visibility);
      if (isGroupVisibility && !effectiveDeptId) {
        throw new Error('Cannot derive a department for this owner');
      }
      const { data, error } = await supabase.from('tasks').insert({
        title,
        description: description || null,
        department_id: effectiveDeptId,
        owner_id: ownerId,
        assigned_by: user!.id,
        priority,
        due_date: dueDate,
        is_private: vis.is_private,
        task_group_id: vis.task_group_id,
        origin_type: 'standalone',
        created_by: user!.id,
      } as any).select('id').single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Task created' });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
      logAudit('tasks', data.id, 'INSERT', null, { title, origin_type: 'standalone' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(isMobile && 'h-full max-h-full w-full max-w-full rounded-none border-0', 'sm:max-w-lg')}>
        <DialogHeader><DialogTitle>Create Task</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto">
          <div><Label>Title *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 mt-1" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="mt-1" /></div>
          <div>
            <Label>Department *</Label>
            {isGroupVisibility ? (
              <div className="h-11 mt-1 flex items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                {derivedDeptName || 'Auto from owner'}
              </div>
            ) : (
              <Select value={deptId} onValueChange={setDeptId}>
                <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div>
            <Label>Owner *</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="h-11 mt-1"><SelectValue placeholder={isGroupVisibility ? 'Select group member' : 'Select'} /></SelectTrigger>
              <SelectContent>{ownerOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
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
          <div>
            <Label className="text-sm">Visible to</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as VisibilityChoice)}>
              <SelectTrigger className="h-11 mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Everyone</SelectItem>
                <SelectItem value="private">Private (creator + assignee only)</SelectItem>
                {pickableGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                      {g.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showOwnerNotInGroupWarning && selectedGroup && (
              <div
                role="alert"
                data-testid="owner-not-in-group-warning"
                className="mt-2 flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  <strong>{ownerName}</strong> is not a member of <strong>{selectedGroup.name}</strong>. They will still be able to see this task as the assignee, but won't have access to other group tasks. Consider adding them to the group first.
                </span>
              </div>
            )}
          </div>
          <Button onClick={() => createMutation.mutate()} disabled={!title || !effectiveDeptId || !ownerId || !dueDate || createMutation.isPending} className="w-full h-12">
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const MAX_COMMENT_LEN = 1000;

function ActivityFeed({
  items,
  onAddComment,
  isAdding,
}: {
  items: any[];
  onAddComment: (text: string) => void;
  isAdding: boolean;
}) {
  const [comment, setComment] = useState('');
  const sorted = sortActivityOldestFirst(items);

  const submit = () => {
    const text = comment.trim();
    if (!text || isAdding) return;
    onAddComment(text);
    setComment('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Activity</h3>
      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">No activity yet</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((h) => {
            const type = (h.update_type as
              | 'status_change'
              | 'comment'
              | 'due_date_change'
              | 'title_change'
              | 'description_change'
              | 'assignee_change') || 'status_change';
            const userName = h.updater?.full_name || 'User';
            const summary = formatActivityItem(
              type,
              h.previous_status,
              h.new_status,
              h.update_note,
              h.previous_due_date,
              h.new_due_date,
              h.previous_text,
              h.new_text,
            );
            const Icon =
              type === 'comment' ? MessageSquare
              : type === 'due_date_change' ? CalendarIcon
              : type === 'title_change' ? Pencil
              : type === 'description_change' ? FileText
              : type === 'assignee_change' ? UserCheck
              : ArrowRight;
            return (
              <div key={h.id} className="flex items-start gap-2 text-xs">
                <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                  <Icon className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  {type === 'comment' ? (
                    <>
                      <p>
                        <span className="font-medium">{userName}</span>
                        <span className="text-muted-foreground"> added a comment</span>
                        <span className="text-muted-foreground"> · {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}</span>
                      </p>
                      <div className="mt-1 border-l-2 border-primary/30 bg-muted/40 rounded px-2 py-1.5 text-foreground whitespace-pre-wrap">
                        {summary}
                      </div>
                    </>
                  ) : (
                    <p>
                      <span className="font-medium">{userName}</span>
                      <span className="text-muted-foreground"> {summary}</span>
                      <span className="text-muted-foreground"> · {formatDistanceToNow(new Date(h.created_at), { addSuffix: true })}</span>
                      {type === 'title_change' && (
                        <span className="block text-muted-foreground mt-0.5">
                          <span className="italic">Old:</span> {h.previous_text}
                          <br />
                          <span className="italic">New:</span> {h.new_text}
                        </span>
                      )}
                      {h.update_note && type !== 'title_change' && (
                        <span className="block text-muted-foreground mt-0.5 italic">{h.update_note}</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 space-y-1">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LEN))}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment or update..."
          rows={2}
          maxLength={MAX_COMMENT_LEN}
          className="text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{comment.length}/{MAX_COMMENT_LEN}</span>
          <Button
            size="sm"
            className="h-8 gap-1"
            disabled={!comment.trim() || isAdding}
            onClick={submit}
          >
            {isAdding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Add Comment
          </Button>
        </div>
      </div>
    </div>
  );
}
