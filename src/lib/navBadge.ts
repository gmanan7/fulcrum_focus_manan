/**
 * Format a numeric badge count for display on a nav icon.
 * - 0 returns null (badge should be hidden)
 * - 1..99 returns the exact number as a string
 * - 100+ returns "99+"
 */
export function formatBadgeCount(count: number): string | null {
  if (!count || count <= 0) return null;
  if (count >= 100) return '99+';
  return String(count);
}
