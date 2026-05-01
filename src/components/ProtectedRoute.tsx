import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { isTaskOnlyRoles, isTaskOnlyRestrictedPath } from '@/lib/utils';

const SHOP_FLOOR_RESTRICTED = [
  '/dashboard',
  '/my-view',
  '/tasks',
  '/meetings',
  '/compliance',
  '/kpi/master',
  '/admin',
];

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // shop_floor-only users are restricted to /kpi/entry and /planner
  const isShopFloorOnly = roles.length === 1 && roles[0] === 'shop_floor';
  if (isShopFloorOnly) {
    const restricted = SHOP_FLOOR_RESTRICTED.some(
      (p) => location.pathname === p || location.pathname.startsWith(p + '/'),
    );
    if (restricted) {
      return <Navigate to="/kpi/entry" replace />;
    }
  }

  // task_only users only get the Task Board and the Personal Planner
  if (isTaskOnlyRoles(roles) && isTaskOnlyRestrictedPath(location.pathname)) {
    return <Navigate to="/tasks" replace />;
  }

  return <>{children}</>;
}
