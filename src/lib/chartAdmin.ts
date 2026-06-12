/* Pure helpers for KPI Chart Admin */
export const CHART_COLOR_PRESETS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

export type ChartType = 'line' | 'bar' | 'composed';
export type RenderAs = 'line' | 'bar';
export type Axis = 'primary' | 'secondary';

export interface ChartKpiRow {
  kpi_id: string;
  render_as: RenderAs;
  axis: Axis;
  color: string | null;
  display_order: number;
}

export interface ChartFormState {
  name: string;
  size_width: 1 | 2 | 3;
  size_height: 1 | 2 | 3;
  chart_type: ChartType;
  display_order: number;
  department_id: string | null;
  kpis: ChartKpiRow[];
}

export function canManageCharts(roles: string[]): boolean {
  return roles.includes('super_admin') || roles.includes('factory_manager');
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateChartForm(form: ChartFormState): ValidationResult {
  if (!form.name.trim()) return { ok: false, error: 'Name is required' };
  if (!form.department_id) return { ok: false, error: 'Department is required' };
  if (form.kpis.length < 1) return { ok: false, error: 'At least one KPI is required' };
  if (form.kpis.some((k) => !k.kpi_id)) return { ok: false, error: 'All KPI rows must have a KPI selected' };
  const ids = form.kpis.map((k) => k.kpi_id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length > 0) return { ok: false, error: 'The same KPI cannot appear twice' };
  return { ok: true };
}

export function emptyChartForm(displayOrder = 0): ChartFormState {
  return {
    name: '',
    size_width: 1,
    size_height: 1,
    chart_type: 'composed',
    display_order: displayOrder,
    department_id: null,
    kpis: [],
  };
}
