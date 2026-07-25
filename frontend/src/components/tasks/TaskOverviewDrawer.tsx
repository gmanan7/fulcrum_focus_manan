import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { DB } from '@/integrations/apiClient';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Lock, Users, CalendarDays, ExternalLink } from 'lucide-react';
import { formatDueDate } from '@/lib/taskSort';
import { formatActivityItem, sortActivityOldestFirst } from '@/lib/taskActivity';
import { getVisibilityKind } from '@/lib/taskOverview';
import { cn } from '@/lib/utils';

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

interface TaskShape {
  id: string;
  task_number?: number | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
  created_at?: string | null;
  is_private?: boolean | null;
  task_group_id?: string | null;
  resolution_note?: string | null;
  origin_meeting_id?: string | null;
  owner?: { full_name?: string | null } | null;
  assignedBy?: { full_name?: string | null } | null;
  dept?: { name?: string | null } | null;
  group?: { name?: string | null; color?: string | null } | null;
  meeting?: { id?: string; title?: string | null; scheduled_date?: string | null } | null;
}

interface Props {
  task: TaskShape | null;
  open: boolean;
  onClose: () => void;
}

export function TaskOverviewDrawer({ task, open, onClose }: Props) {
  const { data: activity } = useQuery({
    queryKey: ['task-overview-activity', task?.id],
    enabled: !!task?.id && open,
    queryFn: async () => {
      const { data, error } = await DB
        .from('task_updates')
        .select('*, actor:profiles!task_updates_updated_by_fkey(full_name)')
        .eq('task_id', task!.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  if (!task) return null;

  const visibility = getVisibilityKind(task);
  const sortedActivity = sortActivityOldestFirst(activity || []);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">#{task.task_number ?? '—'}</Badge>
            <Badge className={cn('text-xs capitalize', STATUS_COLORS[task.status] || '')}>
              {task.status.replace('_', ' ')}
            </Badge>
            <Badge className={cn('text-xs capitalize', PRIORITY_COLORS[task.priority] || '')}>
              {task.priority}
            </Badge>
            {visibility === 'private' && (
              <Badge variant="outline" className="text-xs gap-1 border-rag-amber/50 text-warning">
                <Lock className="h-3 w-3" /> Private
              </Badge>
            )}
            {visibility === 'group' && task.group && (
              <Badge
                variant="outline"
                className="text-xs gap-1 border"
                style={{ borderColor: task.group.color ?? undefined, color: task.group.color ?? undefined }}
              >
                <Users className="h-3 w-3" /> {task.group.name}
              </Badge>
            )}
          </div>
          <SheetTitle className="text-lg leading-snug text-left">{task.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Field label="Department" value={task.dept?.name ?? '—'} />
            <Field label="Owner" value={task.owner?.full_name ?? '—'} />
            <Field label="Assigned by" value={task.assignedBy?.full_name ?? '—'} />
            <Field
              label="Due date"
              value={task.due_date ? formatDueDate(task.due_date) ?? '—' : '—'}
            />
            <Field
              label="Created"
              value={task.created_at ? format(new Date(task.created_at), 'd MMM yyyy') : '—'}
            />
            <Field
              label="Visibility"
              value={
                visibility === 'private'
                  ? 'Private'
                  : visibility === 'group'
                  ? `Group: ${task.group?.name ?? '—'}`
                  : 'Public'
              }
            />
          </div>

          {task.description && (
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap text-foreground">{task.description}</p>
            </section>
          )}

          {task.resolution_note && (
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-1">Resolution note</p>
              <p className="text-sm whitespace-pre-wrap text-foreground">{task.resolution_note}</p>
            </section>
          )}

          {task.meeting && task.origin_meeting_id && (
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-1">Origin</p>
              <Link
                to={`/meetings/${task.origin_meeting_id}/workspace`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                {task.meeting.title || 'Meeting'}
                {task.meeting.scheduled_date && (
                  <span className="text-muted-foreground">
                    · {format(new Date(task.meeting.scheduled_date), 'd MMM yyyy')}
                  </span>
                )}
                <ExternalLink className="h-3 w-3" />
              </Link>
            </section>
          )}

          <section>
            <p className="text-xs font-medium text-muted-foreground mb-2">Activity</p>
            {sortedActivity.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {sortedActivity.map((row: any) => (
                  <li key={row.id} className="rounded-md border border-border bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {row.actor?.full_name || 'Someone'}
                      </span>{' '}
                      ·{' '}
                      {row.created_at
                        ? format(new Date(row.created_at), 'd MMM yyyy, HH:mm')
                        : ''}
                    </p>
                    <p className="text-sm text-foreground mt-0.5">
                      {formatActivityItem(
                        row.update_type,
                        row.previous_status,
                        row.new_status,
                        row.update_note,
                        row.previous_due_date,
                        row.new_due_date,
                        row.previous_text,
                        row.new_text,
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-xs text-muted-foreground italic border-t border-border pt-3">
            To modify this task, the owner or assignee must make changes from the Task Board.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}
