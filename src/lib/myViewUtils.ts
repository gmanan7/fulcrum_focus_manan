/**
 * Utility functions for the My View personal KPI dashboard.
 */

export interface PinnedItem {
  id: string;
  kpi_id: string;
  display_order: number;
}

/**
 * Returns pinned KPIs sorted by display_order ascending.
 */
export function getPinnedKpis<T extends { display_order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.display_order - b.display_order);
}

/**
 * Reorders items by moving item at `fromIndex` up (direction = -1) or down (direction = 1).
 * Returns a new array with recalculated display_order values (0-indexed).
 */
export function reorderItems<T extends { display_order: number }>(
  items: T[],
  fromIndex: number,
  direction: -1 | 1
): T[] {
  const sorted = getPinnedKpis(items);
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= sorted.length) return sorted;
  const result = [...sorted];
  [result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
  return result.map((item, i) => ({ ...item, display_order: i }));
}

/**
 * Returns true when pinned count is >= 12 (max allowed).
 */
export function isAtMaxPins(pinnedCount: number): boolean {
  return pinnedCount >= 12;
}

/**
 * Returns true when user has at least 1 pinned KPI (should redirect to /my-view).
 */
export function shouldRedirectToMyView(pinnedCount: number): boolean {
  return pinnedCount >= 1;
}

/**
 * Filters KPIs by search term (case-insensitive match on name).
 */
export function filterAvailableKpis<T extends { name: string }>(
  kpis: T[],
  searchTerm: string
): T[] {
  if (!searchTerm.trim()) return kpis;
  const lower = searchTerm.toLowerCase();
  return kpis.filter((k) => k.name.toLowerCase().includes(lower));
}
