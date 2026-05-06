import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  digestStorageKey, getGreeting, firstName, groupDigestTasks, daysOverdue,
  shouldShowDigest, type DigestTaskLike,
} from '@/lib/dailyDigest';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When true, skip the localStorage gate and show whenever there are tasks. */
  manual?: boolean;
}

export function DailyDigestModal({ open, onOpenChange, manual = false }: Props) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: tasks } = useQuery({
    queryKey: ['daily-digest-tasks', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, owner_id, status, due_date')
        .eq('owner_id', user!.id)
        .not('status', 'in', '(completed,cancelled)')
        .lte('due_date', today);
      if (error) throw error;
      return (data ?? []) as DigestTaskLike[];
    },
    enabled: !!user?.id && open,
  });

  const groups = groupDigestTasks(tasks ?? [], user?.id);
  const total = groups.overdue.length + groups.dueToday.length;
  const greeting = getGreeting();
  const fname = firstName(profile?.full_name);

  const goToTask = (id: string) => {
    onOpenChange(false);
    navigate(`/tasks?taskId=${id}`);
  };

  const viewAll = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('fulcrum-mytasks-filter', '1');
    }
    onOpenChange(false);
    navigate('/tasks');
  };

  // For auto-show: if data loads and there are no tasks, close silently.
  useEffect(() => {
    if (!manual && open && tasks && total === 0) onOpenChange(false);
  }, [manual, open, tasks, total, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{greeting}{fname ? `, ${fname}` : ''}!</DialogTitle>
          <DialogDescription>
            {total} {total === 1 ? 'task needs' : 'tasks need'} your attention today
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh] pr-2">
          <div className="space-y-4">
            {groups.overdue.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Overdue ({groups.overdue.length})
                </div>
                <ul className="space-y-1">
                  {groups.overdue.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => goToTask(t.id)}
                        className="w-full rounded-md border border-destructive/30 bg-destructive/5 p-2 text-left text-sm hover:bg-destructive/10"
                      >
                        <span className="font-medium text-foreground">{t.title}</span>
                        <span className="ml-2 text-xs text-destructive">
                          — {daysOverdue(t.due_date!)} day{daysOverdue(t.due_date!) === 1 ? '' : 's'} overdue
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {groups.dueToday.length > 0 && (
              <section>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-rag-amber">
                  <Clock className="h-4 w-4" />
                  Due Today ({groups.dueToday.length})
                </div>
                <ul className="space-y-1">
                  {groups.dueToday.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => goToTask(t.id)}
                        className="w-full rounded-md border border-rag-amber/30 bg-rag-amber/5 p-2 text-left text-sm hover:bg-rag-amber/10"
                      >
                        <span className="font-medium text-foreground">{t.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {tasks && total === 0 && (
              <p className="text-sm text-muted-foreground">No overdue or due-today tasks. 🎉</p>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={viewAll}>View All Tasks</Button>
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook that decides whether to auto-show the digest after login.
 * Returns the open state and a setter; the caller renders the modal.
 */
export function useAutoDigest(): { open: boolean; setOpen: (v: boolean) => void } {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: count } = useQuery({
    queryKey: ['daily-digest-count', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('tasks')
        .select('id', { count: 'exact', head: false })
        .eq('owner_id', user!.id)
        .not('status', 'in', '(completed,cancelled)')
        .lte('due_date', today);
      if (error) throw error;
      return (data ?? []).length;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (count == null) return;
    if (typeof window === 'undefined') return;
    if (shouldShowDigest(count, localStorage)) {
      setOpen(true);
      localStorage.setItem(digestStorageKey(), '1');
    }
  }, [count]);

  return { open, setOpen };
}
