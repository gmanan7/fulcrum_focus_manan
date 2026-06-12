import { describe, it, expect } from 'vitest';
import {
  canManageCharts,
  validateChartForm,
  emptyChartForm,
  type ChartFormState,
} from '@/lib/chartAdmin';

const baseForm = (overrides: Partial<ChartFormState> = {}): ChartFormState => ({
  ...emptyChartForm(0),
  name: 'My Chart',
  kpis: [
    { kpi_id: 'a', render_as: 'line', axis: 'primary', color: null, display_order: 0 },
  ],
  ...overrides,
});

describe('canManageCharts', () => {
  it('allows super_admin', () => expect(canManageCharts(['super_admin'])).toBe(true));
  it('allows factory_manager', () => expect(canManageCharts(['factory_manager'])).toBe(true));
  it('blocks team_member', () => expect(canManageCharts(['team_member'])).toBe(false));
  it('blocks empty roles', () => expect(canManageCharts([])).toBe(false));
  it('blocks shop_floor', () => expect(canManageCharts(['shop_floor'])).toBe(false));
});

describe('validateChartForm', () => {
  it('passes with valid form', () => {
    expect(validateChartForm(baseForm()).ok).toBe(true);
  });
  it('fails without name', () => {
    const r = validateChartForm(baseForm({ name: '   ' }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/name/i);
  });
  it('fails with no KPIs', () => {
    const r = validateChartForm(baseForm({ kpis: [] }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/KPI/);
  });
  it('rejects duplicate KPIs', () => {
    const r = validateChartForm(baseForm({
      kpis: [
        { kpi_id: 'a', render_as: 'line', axis: 'primary', color: null, display_order: 0 },
        { kpi_id: 'a', render_as: 'bar', axis: 'secondary', color: null, display_order: 1 },
      ],
    }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/twice/i);
  });
  it('rejects rows with empty kpi_id', () => {
    const r = validateChartForm(baseForm({
      kpis: [{ kpi_id: '', render_as: 'line', axis: 'primary', color: null, display_order: 0 }],
    }));
    expect(r.ok).toBe(false);
  });
});

describe('emptyChartForm', () => {
  it('defaults to composed/1x1', () => {
    const f = emptyChartForm(5);
    expect(f.chart_type).toBe('composed');
    expect(f.size_width).toBe(1);
    expect(f.size_height).toBe(1);
    expect(f.display_order).toBe(5);
    expect(f.kpis).toEqual([]);
  });
});
