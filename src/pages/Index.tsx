import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultRouteForRoles } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export default function Index() {
  const { session, roles, loading } = useAuth();
  const userId = session?.user?.id;
  const isShopFloorOnly = roles.length === 1 && roles[0] === 'shop_floor';

  const { data: pinnedCount, isLoading: loadingPinned } = useQuery({
    queryKey: ['my-view-count', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('my_view_items')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId && !isShopFloorOnly,
  });

  if (loading || loadingPinned) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isShopFloorOnly && pinnedCount && pinnedCount > 0) {
    return <Navigate to="/my-view" replace />;
  }

  return <Navigate to={getDefaultRouteForRoles(roles)} replace />;
}
