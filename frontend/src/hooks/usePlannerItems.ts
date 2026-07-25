import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DB } from '@/integrations/apiClient';
import { useAuth } from '@/hooks/useAuth';

export interface PlannerItem {
  id: string;
  user_id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  display_order: number;
  recurrence_type: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrence_day_of_week: number | null;
  recurrence_day_of_month: number | null;
  origin_context: string | null;
  created_at: string;
  updated_at: string;
}

export function usePlannerItems() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['planner_items', user?.id],
    queryFn: async () => {
      const { data, error } = await DB
        .from('planner_items' as any)
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PlannerItem[];
    },
    enabled: !!user,
  });

  const addItem = useMutation({
    mutationFn: async (item: Partial<PlannerItem>) => {
      const { data, error } = await DB
        .from('planner_items' as any)
        .insert({ ...item, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PlannerItem;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planner_items'] }),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlannerItem> & { id: string }) => {
      const { data, error } = await DB
        .from('planner_items' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as PlannerItem;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planner_items'] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await DB
        .from('planner_items' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planner_items'] }),
  });

  const completeItem = useMutation({
    mutationFn: async (item: PlannerItem) => {
      const now = new Date().toISOString();
      // Mark current item as completed
      const { error } = await DB
        .from('planner_items' as any)
        .update({ is_completed: true, completed_at: now, updated_at: now } as any)
        .eq('id', item.id);
      if (error) throw error;

      // If recurring, create next occurrence
      if (item.recurrence_type && item.recurrence_type !== 'none') {
        const nextDue = calculateNextDue(item);
        await DB
          .from('planner_items' as any)
          .insert({
            user_id: user!.id,
            title: item.title,
            notes: item.notes,
            due_date: nextDue,
            recurrence_type: item.recurrence_type,
            recurrence_day_of_week: item.recurrence_day_of_week,
            recurrence_day_of_month: item.recurrence_day_of_month,
            origin_context: `recurrence:${item.id}`,
          } as any);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planner_items'] }),
  });

  const uncompleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await DB
        .from('planner_items' as any)
        .update({ is_completed: false, completed_at: null, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planner_items'] }),
  });

  const deleteCompleted = useMutation({
    mutationFn: async () => {
      const { error } = await DB
        .from('planner_items' as any)
        .delete()
        .eq('is_completed', true)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['planner_items'] }),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    addItem,
    updateItem,
    deleteItem,
    completeItem,
    uncompleteItem,
    deleteCompleted,
  };
}

function calculateNextDue(item: PlannerItem): string {
  const base = item.due_date ? new Date(item.due_date + 'T00:00:00') : new Date();
  
  switch (item.recurrence_type) {
    case 'daily':
      base.setDate(base.getDate() + 1);
      break;
    case 'weekly': {
      base.setDate(base.getDate() + 7);
      break;
    }
    case 'monthly': {
      base.setMonth(base.getMonth() + 1);
      if (item.recurrence_day_of_month) {
        base.setDate(Math.min(item.recurrence_day_of_month, new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()));
      }
      break;
    }
  }
  
  return base.toISOString().split('T')[0];
}
