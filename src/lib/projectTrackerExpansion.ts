/**
 * Pure helpers for the dashboard's project_tracker row expansion.
 * Kept framework-free so they can be unit-tested without React.
 */

export type ProjectItemStatus = 'active' | 'completed' | 'on_hold' | 'dropped';

export interface ProjectTrackerItem {
  id: string;
  kpi_id: string;
  title: string;
  status: ProjectItemStatus;
  display_order?: number | null;
}

export const STATUS_LABELS: Record<ProjectItemStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
  dropped: 'Dropped',
};

/** Filter project items belonging to a given KPI, sorted by display_order then title. */
export function filterItemsForKpi(
  items: ProjectTrackerItem[] | null | undefined,
  kpiId: string,
): ProjectTrackerItem[] {
  if (!items || items.length === 0) return [];
  return items
    .filter((it) => it.kpi_id === kpiId)
    .sort((a, b) => {
      const ao = a.display_order ?? 0;
      const bo = b.display_order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title);
    });
}

/** Empty-state message used when a project_tracker KPI has no items. */
export const EMPTY_PROJECT_TRACKER_MESSAGE = 'No items added yet';
