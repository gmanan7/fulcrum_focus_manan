import { useState, useEffect } from 'react';
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
  Plus, Loader2, Filter, AlertTriangle, Clock,
  ArrowRight, CheckCircle2, XCircle, Pause, Play, ListTodo, Columns3,
  MessageSquare, Calendar as CalendarIcon, Send,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn, isTaskOverdue, isTaskDueToday } from '@/lib/utils';
import { canUpdateTaskAnyRole, TASK_UPDATE_FORBIDDEN_TOOLTIP } from '@/lib/taskPermissions';
import { formatActivityItem, sortActivityOldestFirst } from '@/lib/taskActivity';
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'kanban' | 'list'>(isMobile ? 'list' : 'kanban');
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

  useEffect(() => {
    const markCarryover = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      await supabase.from('tasks')
        .update({ is_carryover: true })
        .lt('due_date', today)
        .not('status', 'in', '("completed","cancelled")')
        .eq('is_carryover', false);
    };
    markCarryover();
  }, []);

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

  const overdueCount = tasks?.filter(isTaskOverdue).length ?? 0;
  const dueTodayCount = tasks?.filter(isTaskDueToday).length ?? 0;

  const applyChipFilters = (list: any[]) => {
    let result = list;
    if (chipOverdue) result = result.filter(isTaskOverdue);
    if (chipDueToday) result = result.filter(isTaskDueToday);
    return result;
  };

  const activeTasks = applyChipFilters(tasks?.filter((t) => t.status !== 'completed' && t.status !== 'cancelled') || []);
  const completedTasks = applyChipFilters(tasks?.filter((t) => t.status === 'completed') || []);
  const cancelledTasks = applyChipFilters(tasks?.filter((t) => t.status === 'cancelled') || []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">Task Board</h1>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <div className="flex border rounded-md overflow-hidden">
              <Button size="sm" variant={view === 'kanban' ? 'default' : 'ghost'} className="h-8 rounded-none gap-1" onClick={() => setView('kanban')}>
                <Columns3 className="h-3.5 w-3.5" /> Kanban
              </Button>
              <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} className="h-8 rounded-none gap-1" onClick={() => setView('list')}>
                <ListTodo className="h-3.5 w-3.5" /> List
              </Button>
            </div>
          )}
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3.5 w-3.5" /> Filters
          </Button>
          <Button onClick={() => setShowCreate(true)} className="h-8 gap-1 text-sm">
            <Plus className="h-3.5 w-3.5" /> New Task
          </Button>
        </div>
      </div>

      <Collapsible open={showFilters}>
        <CollapsibleContent>
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
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
                    <KanbanCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Tabs value={activeListTab} onValueChange={(v) => setActiveListTab(v as any)}>
          <TabsList className="bg-muted/50">
            <TabsTrigger value="active" className="text-xs">Active ({activeTasks.length})</TabsTrigger>
            <TabsTrigger value="recent" className="text-xs">Recently Closed ({recentlyClosed?.length || 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="active" className="mt-3 space-y-2">
            {activeTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No active tasks.</p>
            ) : (
              activeTasks.map((task) => (
                <TaskListCard key={task.id} task={task} onClick={() => setSelectedTask(task)} />
              ))
            )}
          </TabsContent>
          <TabsContent value="recent" className="mt-3 space-y-2">
            {!recentlyClosed?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recently closed tasks.</p>
            ) : (
              recentlyClosed.map((task) => (
                <TaskListCard key={task.id} task={task} onClick={() => setSelectedTask(task)} readOnly />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      {selectedTask && <TaskDetailDrawer task={selectedTask} open={!!selectedTask} onOpenChange={(v) => !v && setSelectedTask(null)} />}
      {showCreate && <CreateTaskModal open={showCreate} onOpenChange={setShowCreate} />}
    </div>
  );
}

function KanbanCard({ task, onClick }: { task: any; onClick: () => void }) {
  const isOverdue = !['completed', 'cancelled'].includes(task.status) && new Date(task.due_date) < new Date();
  return (
    <Card className={cn('cursor-pointer hover:shadow-md transition-shadow', isOverdue && 'border-destructive/30')} onClick={onClick}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-muted-foreground">#{task.task_number}</span>
            <p className="text-sm font-medium leading-tight truncate">{task.title}</p>
          </div>
          <Badge className={cn('text-[10px] shrink-0', PRIORITY_COLORS[task.priority])}>{task.priority}</Badge>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground">{(task as any).owner?.full_name}</span>
          {(task as any).dept?.name && <Badge variant="secondary" className="text-[10px]">{(task as any).dept.name}</Badge>}
        </div>
        {isOverdue && (
          <p className="text-[10px] text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {Math.ceil(differenceInDays(new Date(), new Date(task.due_date)))} days overdue
          </p>
        )}
        {task.is_carryover && <Badge variant="secondary" className="text-[10px]">Carryover</Badge>}
        {(task as any).meeting && <span className="text-[10px] text-muted-foreground">Meeting: {(task as any).meeting.title}</span>}
      </CardContent>
    </Card>
  );
}

function TaskListCard({ task, onClick, readOnly }: { task: any; onClick?: () => void; readOnly?: boolean }) {
  const isOverdue = !['completed', 'cancelled'].includes(task.status) && new Date(task.due_date) < new Date();
  return (
    <Card className={cn('cursor-pointer active:bg-muted/50', isOverdue && 'border-destructive/30')} onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{task.task_number}</span>
              <p className="text-sm font-medium truncate">{task.title}</p>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{(task as any).owner?.full_name}</span>
              {(task as any).dept?.name && <Badge variant="secondary" className="text-[10px]">{(task as any).dept.name}</Badge>}
              {isOverdue && <span className="text-[10px] text-destructive">{Math.ceil(differenceInDays(new Date(), new Date(task.due_date)))}d overdue</span>}
              {task.is_carryover && <Badge variant="secondary" className="text-[10px]">Carryover</Badge>}
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
  const [editDueDate, setEditDueDate] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');
  const canEdit = hasAnyRole('super_admin', 'factory_manager');

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

  const { data: editDeptUsers } = useQuery({
    queryKey: ['dept-users-edit-task', editDeptId],
    queryFn: async () => {
      const { data: uds } = await supabase.from('user_departments').select('user_id').eq('department_id', editDeptId);
      if (!uds?.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', uds.map((u) => u.user_id)).eq('is_active', true);
      return data || [];
    },
    enabled: !!editDeptId && editMode,
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
      const updates: any = { status: newStatus, updated_at: new Date().toISOString() };
      if (newStatus === 'completed' || newStatus === 'cancelled') {
        updates.completed_at = new Date().toISOString();
        updates.resolution_note = note || resolutionNote;
      }

      const { error: updateErr } = await supabase.from('tasks').update(updates).eq('id', task.id);
      if (updateErr) throw updateErr;

      const { error: logErr } = await supabase.from('task_updates').insert({
        task_id: task.id,
        previous_status: freshTask?.status || task.status,
        new_status: newStatus,
        updated_by: user!.id,
        update_note: note || updateNote || null,
        update_type: 'status_change',
      } as any);
      if (logErr) throw logErr;
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
      const prevDue = freshTask?.due_date || task.due_date;
      await supabase.from('task_due_date_history').insert({
        task_id: task.id,
        previous_due_date: prevDue,
        new_due_date: newDueDate,
        reason: dueDateReason,
        changed_by: user!.id,
      });
      await supabase.from('tasks').update({ due_date: newDueDate, updated_at: new Date().toISOString() }).eq('id', task.id);
      // Log to activity feed
      await supabase.from('task_updates').insert({
        task_id: task.id,
        updated_by: user!.id,
        update_type: 'due_date_change',
        previous_due_date: prevDue,
        new_due_date: newDueDate,
        update_note: dueDateReason || null,
      } as any);
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

  const editTaskMutation = useMutation({
    mutationFn: async () => {
      if (editDueDate < today) throw new Error('Due date cannot be in the past');
      const oldValues = { title: t.title, description: t.description, department_id: t.department_id, owner_id: t.owner_id, priority: t.priority, due_date: t.due_date };
      const { error } = await supabase.from('tasks').update({
        title: editTitle,
        description: editDescription || null,
        department_id: editDeptId,
        owner_id: editOwnerId,
        priority: editPriority,
        due_date: editDueDate,
        updated_at: new Date().toISOString(),
      }).eq('id', task.id);
      if (error) throw error;
      if (t.due_date !== editDueDate) {
        await supabase.from('task_updates').insert({
          task_id: task.id,
          updated_by: user!.id,
          update_type: 'due_date_change',
          previous_due_date: t.due_date,
          new_due_date: editDueDate,
        } as any);
      }
      logAudit('tasks', task.id, 'UPDATE', oldValues, { title: editTitle, description: editDescription, department_id: editDeptId, owner_id: editOwnerId, priority: editPriority, due_date: editDueDate });
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
        <Select value={editDeptId} onValueChange={(v) => { setEditDeptId(v); setEditOwnerId(''); }}>
          <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>{editDepartments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Owner *</Label>
        <Select value={editOwnerId} onValueChange={setEditOwnerId}>
          <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>{editDeptUsers?.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
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
      <div className="flex gap-2">
        <Button onClick={() => editTaskMutation.mutate()} disabled={!editTitle || !editDeptId || !editOwnerId || !editDueDate || editTaskMutation.isPending} className="flex-1 h-11">
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
          {canEdit && !isTerminal && (
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

      {!isTerminal && (
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
        const canUpdate = !!user && canUpdateTaskAnyRole(t, user.id, roles as string[]);
        const onSelectStatus = (newStatus: TaskStatus) => {
          if (!canUpdate || newStatus === t.status) return;
          if (newStatus === 'completed' || newStatus === 'cancelled') {
            setCompletingAs(newStatus);
            setShowCompleteDialog(true);
            return;
          }
          changeStatusMutation.mutate({ newStatus });
        };
        const Buttons = (
          <div className="flex flex-wrap gap-2">
            {t.status === 'open' && (
              <>
                <Button size="sm" disabled={!canUpdate} className="h-10 gap-1" onClick={() => changeStatusMutation.mutate({ newStatus: 'in_progress' })}>
                  <Play className="h-3.5 w-3.5" /> Start Work
                </Button>
                <Button size="sm" disabled={!canUpdate} variant="outline" className="h-10 gap-1" onClick={() => { setCompletingAs('cancelled'); setShowCompleteDialog(true); }}>
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </Button>
              </>
            )}
            {t.status === 'in_progress' && (
              <>
                <Button size="sm" disabled={!canUpdate} variant="outline" className="h-10 gap-1" onClick={() => changeStatusMutation.mutate({ newStatus: 'blocked' })}>
                  <Pause className="h-3.5 w-3.5" /> Mark Blocked
                </Button>
                <Button size="sm" disabled={!canUpdate} className="h-10 gap-1 bg-rag-green hover:bg-rag-green/90 text-white" onClick={() => { setCompletingAs('completed'); setShowCompleteDialog(true); }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </Button>
              </>
            )}
            {t.status === 'blocked' && (
              <>
                <Button size="sm" disabled={!canUpdate} className="h-10 gap-1" onClick={() => changeStatusMutation.mutate({ newStatus: 'in_progress' })}>
                  <Play className="h-3.5 w-3.5" /> Resume
                </Button>
                <Button size="sm" disabled={!canUpdate} className="h-10 gap-1 bg-rag-green hover:bg-rag-green/90 text-white" onClick={() => { setCompletingAs('completed'); setShowCompleteDialog(true); }}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                </Button>
              </>
            )}
          </div>
        );
        return (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</h3>

            {/* Status dropdown — allows changing in any direction */}
            <div className="space-y-1">
              <Label className="text-xs">Change Status</Label>
              {canUpdate ? (
                <Select value={t.status} onValueChange={(v) => onSelectStatus(v as TaskStatus)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
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
                    <TooltipContent>{TASK_UPDATE_FORBIDDEN_TOOLTIP}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Quick action buttons — disabled & tooltipped if not permitted */}
            {canUpdate ? Buttons : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="opacity-60 cursor-not-allowed">{Buttons}</div>
                  </TooltipTrigger>
                  <TooltipContent>{TASK_UPDATE_FORBIDDEN_TOOLTIP}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
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

      {(t as any).meeting && (
        <div>
          <span className="text-muted-foreground text-xs">Origin</span>
          <p className="text-sm">Created in: <a href={`/meetings/${(t as any).meeting.id}/workspace`} className="text-primary underline">{(t as any).meeting.title} ({format(new Date((t as any).meeting.scheduled_date), 'dd MMM')})</a></p>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status History</h3>
        {statusHistory?.length ? (
          <div className="space-y-2">
            {statusHistory.map((h) => (
              <div key={h.id} className="flex items-start gap-2 text-xs border-l-2 border-muted pl-3 py-1">
                <div className="flex-1">
                  <span className="font-medium">{h.previous_status || '—'}</span>
                  <ArrowRight className="h-3 w-3 inline mx-1" />
                  <span className="font-medium">{h.new_status}</span>
                  {h.update_note && <p className="text-muted-foreground mt-0.5">{h.update_note}</p>}
                </div>
                <div className="text-right shrink-0 text-muted-foreground">
                  <p>{(h as any).updater?.full_name}</p>
                  <p>{format(new Date(h.created_at), 'dd MMM HH:mm')}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No status changes recorded.</p>
        )}
      </div>

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

function CreateTaskModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deptId, setDeptId] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const today = format(new Date(), 'yyyy-MM-dd');

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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (dueDate < today) throw new Error('Due date cannot be in the past');
      const { data, error } = await supabase.from('tasks').insert({
        title,
        description: description || null,
        department_id: deptId,
        owner_id: ownerId,
        assigned_by: user!.id,
        priority,
        due_date: dueDate,
        origin_type: 'standalone',
        created_by: user!.id,
      }).select('id').single();
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
            <Select value={deptId} onValueChange={setDeptId}>
              <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Owner *</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger className="h-11 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{deptUsers?.map((u) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}</SelectContent>
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
          <Button onClick={() => createMutation.mutate()} disabled={!title || !deptId || !ownerId || !dueDate || createMutation.isPending} className="w-full h-12">
            {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Task
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
