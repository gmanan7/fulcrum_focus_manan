/**
 * Pure mirror of the tasks_read RLS policy for unit testing & documentation.
 *
 * A task is visible to a viewer when:
 *   - it is public (is_private = false) and the viewer is authenticated, OR
 *   - it is private and the viewer is the assigner, the owner,
 *     a super_admin, or a factory_manager.
 */
export interface TaskPrivacyShape {
  is_private: boolean;
  assigned_by: string;
  owner_id: string;
}

export type PrivacyRole = 'super_admin' | 'factory_manager' | string;

export function canViewTask(
  task: TaskPrivacyShape,
  viewerId: string | null,
  viewerRoles: PrivacyRole[] = [],
): boolean {
  // Authenticated check — any signed-in user has a viewerId
  const isAuthenticated = !!viewerId;
  if (!isAuthenticated) return false;

  if (!task.is_private) return true;

  if (task.assigned_by === viewerId) return true;
  if (task.owner_id === viewerId) return true;
  if (viewerRoles.includes('super_admin')) return true;
  if (viewerRoles.includes('factory_manager')) return true;

  return false;
}

/** Default value for is_private on newly created tasks. */
export const DEFAULT_TASK_IS_PRIVATE = false;
