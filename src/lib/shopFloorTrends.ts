import { eachDayOfInterval, format, parseISO } from 'date-fns';

/**
 * Filters KPIs to only numeric type (for shop_floor trend view).
 */
export function filterKpisForShopFloor(kpis: { kpi_type: string }[]) {
  return kpis.filter((k) => k.kpi_type === 'numeric');
}

/**
 * Filters departments to only those the user belongs to.
 */
export function filterDepartmentsForUser(
  allDepartments: { id: string }[],
  userDepartmentIds: string[]
) {
  return allDepartments.filter((d) => userDepartmentIds.includes(d.id));
}

export interface EntryGapResult {
  enteredCount: number;
  totalCount: number;
  missingDates: string[];
  summary: string;
}

/**
 * Calculates data entry gaps within a date range.
 * Returns count of entered/total days and list of missing dates.
 */
export function calculateEntryGaps(
  rangeFrom: Date,
  rangeTo: Date,
  enteredDates: string[] // 'yyyy-MM-dd' format
): EntryGapResult {
  const allDays = eachDayOfInterval({ start: rangeFrom, end: rangeTo });
  const totalCount = allDays.length;
  const enteredSet = new Set(enteredDates);
  const missingDates: string[] = [];

  allDays.forEach((day) => {
    const key = format(day, 'yyyy-MM-dd');
    if (!enteredSet.has(key)) {
      missingDates.push(key);
    }
  });

  const enteredCount = totalCount - missingDates.length;
  return {
    enteredCount,
    totalCount,
    missingDates,
    summary: `${enteredCount} of ${totalCount} days entered`,
  };
}
