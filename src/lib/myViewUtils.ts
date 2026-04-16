/**
 * Utility functions for the My View personal KPI dashboard.
 */

export interface PinnedItem {
  id: string;
  kpi_id: string;
  display_order: number;
}

export interface KpiItem {
  id: string;
  name: string;
  department_id: string;
  kpi_type: string;
  [key: string]: unknown;
}

export interface DeptItem {
  id: string;
  name: string;
  code: string;
  display_order?: number;
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

/**
 * Returns all KPIs visible for My View based on role.
 * All roles except shop_floor see ALL active numeric KPIs.
 * shop_floor sees only their department's KPIs.
 */
export function getAllKpisForMyView<T extends KpiItem>(
  kpis: T[],
  role: string,
  userDeptIds: string[]
): T[] {
  if (role === 'shop_floor') {
    return kpis.filter((k) => userDeptIds.includes(k.department_id));
  }
  return kpis;
}

/**
 * Groups KPIs by department, sorted by department display_order then KPI order.
 */
export function groupKpisByDepartment<T extends { department_id: string }>(
  kpis: T[],
  departments: DeptItem[]
): { dept: DeptItem; kpis: T[] }[] {
  const deptMap = new Map(departments.map((d) => [d.id, d]));
  const groups: Record<string, { dept: DeptItem; kpis: T[] }> = {};

  kpis.forEach((kpi) => {
    const dept = deptMap.get(kpi.department_id);
    if (!dept) return;
    if (!groups[dept.id]) groups[dept.id] = { dept, kpis: [] };
    groups[dept.id].kpis.push(kpi);
  });

  // Sort by department display_order
  return Object.values(groups).sort(
    (a, b) => (a.dept.display_order ?? 0) - (b.dept.display_order ?? 0)
  );
}

/**
 * Filters KPIs and departments by search term.
 * Matches KPI name OR department name/code (case-insensitive).
 */
export function filterKpisBySearch<T extends KpiItem>(
  kpis: T[],
  departments: DeptItem[],
  searchTerm: string
): T[] {
  if (!searchTerm.trim()) return kpis;
  const lower = searchTerm.toLowerCase();
  const deptMap = new Map(departments.map((d) => [d.id, d]));

  // Find departments that match the search term
  const matchingDeptIds = new Set(
    departments
      .filter((d) => d.name.toLowerCase().includes(lower) || d.code.toLowerCase().includes(lower))
      .map((d) => d.id)
  );

  return kpis.filter((k) => {
    // KPI name matches
    if (k.name.toLowerCase().includes(lower)) return true;
    // Department matches — include all KPIs in that department
    if (matchingDeptIds.has(k.department_id)) return true;
    return false;
  });
}

/**
 * Select all KPIs in a department. Returns the KPI IDs that can be added
 * given the current pinned count and max limit of 12.
 * Returns { added: string[], warning: boolean }
 */
export function selectAllInDepartment(
  deptKpiIds: string[],
  currentPinnedIds: Set<string>,
  currentPinnedCount: number
): { added: string[]; warning: boolean } {
  const unpinnedInDept = deptKpiIds.filter((id) => !currentPinnedIds.has(id));
  const available = 12 - currentPinnedCount;

  if (available <= 0) {
    return { added: [], warning: true };
  }

  if (unpinnedInDept.length <= available) {
    return { added: unpinnedInDept, warning: false };
  }

  return { added: unpinnedInDept.slice(0, available), warning: true };
}
