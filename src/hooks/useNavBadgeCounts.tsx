import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface BadgeCounts {
  taskBoard: number;
  planner: number;
  refresh: () => void;
}

const NavBadgeCountsContext = createContext<BadgeCounts>({
  taskBoard: 0,
  planner: 0,
  refresh: () => {},
});

const REFRESH_MS = 5 * 60 * 1000;

export function NavBadgeCountsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [taskBoard, setTaskBoard] = useState(0);
  const [planner, setPlanner] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!user?.id) {
      setTaskBoard(0);
      setPlanner(0);
      return;
    }
    const [tasksRes, plannerRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', user.id)
        .in('status', ['open', 'in_progress']),
      supabase
        .from('planner_items' as any)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_completed', false),
    ]);
    setTaskBoard(tasksRes.count ?? 0);
    setPlanner(plannerRes.count ?? 0);
  }, [user?.id]);

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  // Refresh whenever react-query invalidates tasks or planner_items caches
  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return;
      const key = event.query.queryKey?.[0];
      if (key === 'tasks' || key === 'planner_items') {
        fetchCounts();
      }
    });
    return () => unsub();
  }, [queryClient, fetchCounts]);

  return (
    <NavBadgeCountsContext.Provider value={{ taskBoard, planner, refresh: fetchCounts }}>
      {children}
    </NavBadgeCountsContext.Provider>
  );
}

export function useNavBadgeCounts() {
  return useContext(NavBadgeCountsContext);
}
