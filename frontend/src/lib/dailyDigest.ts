/**
 * Pure helpers for the Daily Task Digest modal.
 */

export interface DigestTaskLike {
  id: string;
  title: string;
  owner_id?: string | null;
  status?: string | null;
  due_date?: string | null;
}

export interface DigestGroups<T extends DigestTaskLike> {
  overdue: T[];
  dueToday: T[];
}

const TERMINAL = new Set(['completed', 'cancelled']);

function toDateOnly(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayDateString(now: Date = new Date()): string {
  return toDateOnly(now);
}

export function digestStorageKey(now: Date = new Date()): string {
  return `fulcrum-digest-shown-${todayDateString(now)}`;
}

export function getGreeting(now: Date = new Date()): 'Good morning' | 'Good afternoon' | 'Good evening' {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string | null | undefined): string {
  const n = (fullName ?? '').trim();
  if (!n) return '';
  return n.split(/\s+/)[0]!;
}

export function groupDigestTasks<T extends DigestTaskLike>(
  tasks: T[],
  userId: string | null | undefined,
  now: Date = new Date(),
): DigestGroups<T> {
  if (!userId) return { overdue: [], dueToday: [] };
  const today = todayDateString(now);
  const overdue: T[] = [];
  const dueToday: T[] = [];
  for (const t of tasks) {
    if (t.owner_id !== userId) continue;
    if (TERMINAL.has(t.status ?? '')) continue;
    if (!t.due_date) continue;
    const d = toDateOnly(t.due_date);
    if (d < today) overdue.push(t);
    else if (d === today) dueToday.push(t);
  }
  return { overdue, dueToday };
}

export function daysOverdue(due: string, now: Date = new Date()): number {
  const today = new Date(todayDateString(now) + 'T00:00:00');
  const d = new Date(toDateOnly(due) + 'T00:00:00');
  return Math.max(1, Math.round((today.getTime() - d.getTime()) / 86400000));
}

export function shouldShowDigest(
  totalCount: number,
  storage: Pick<Storage, 'getItem'>,
  now: Date = new Date(),
): boolean {
  if (totalCount <= 0) return false;
  return storage.getItem(digestStorageKey(now)) == null;
}
