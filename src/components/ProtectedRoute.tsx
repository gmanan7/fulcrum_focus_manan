import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const SHOP_FLOOR_RESTRICTED = [
  '/dashboard',
  '/tasks',
  '/meetings',
  '/compliance',
  '/kpi/trends',
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
      (p) => location.pathname === p || location.pathname.startsWith(p + '/')
    );
    if (restricted) {
      return <Navigate to="/kpi/entry" replace />;
    }
  }

  return <>{children}</>;
}
