export interface MyTaskLike {
  owner_id?: string | null;
  status?: string | null;
}

/**
 * Returns tasks owned by userId that are not completed or cancelled.
 */
export function filterMyTasks<T extends MyTaskLike>(tasks: T[], userId: string | null | undefined): T[] {
  if (!userId) return [];
  return tasks.filter(
    (t) => t.owner_id === userId && t.status !== 'completed' && t.status !== 'cancelled'
  );
}
