import { describe, it, expect } from 'vitest';
import {
  canManageCharts,
  validateChartForm,
  emptyChartForm,
  buildChartInsertPayload,
  type ChartFormState,
} from '@/lib/chartAdmin';

const baseForm = (overrides: Partial<ChartFormState> = {}): ChartFormState => ({
  ...emptyChartForm(0),
  name: 'My Chart',
  department_id: 'dept-1',
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

  it('fails without department', () => {
    const r = validateChartForm(baseForm({ department_id: null }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/department/i);
  });
});

describe('emptyChartForm', () => {
  it('defaults to composed/1x1 with null department', () => {
    const f = emptyChartForm(5);
    expect(f.chart_type).toBe('composed');
    expect(f.size_width).toBe(1);
    expect(f.size_height).toBe(1);
    expect(f.display_order).toBe(5);
    expect(f.department_id).toBeNull();
    expect(f.kpis).toEqual([]);
  });
});

describe('KPI Trends interleave logic', () => {
  type Item = { kind: 'kpi' | 'chart'; id: string; display_order: number };
  const interleave = (kpis: any[], charts: any[]): Item[] =>
    [
      ...kpis.map((k) => ({ kind: 'kpi' as const, id: k.id, display_order: k.display_order ?? 0 })),
      ...charts.map((c) => ({ kind: 'chart' as const, id: c.id, display_order: c.display_order ?? 0 })),
    ].sort((a, b) => a.display_order - b.display_order);

  it('orders kpis and charts together by display_order', () => {
    const kpis = [{ id: 'k1', display_order: 0 }, { id: 'k2', display_order: 2 }];
    const charts = [{ id: 'c1', display_order: 1 }, { id: 'c2', display_order: 3 }];
    const result = interleave(kpis, charts);
    expect(result.map((r) => r.id)).toEqual(['k1', 'c1', 'k2', 'c2']);
    expect(result.map((r) => r.kind)).toEqual(['kpi', 'chart', 'kpi', 'chart']);
  });

  it('groups charts under their assigned department only', () => {
    const charts = [
      { id: 'c1', department_id: 'd1' },
      { id: 'c2', department_id: 'd2' },
      { id: 'c3', department_id: null },
    ];
    const grouped: Record<string, any[]> = {};
    charts.forEach((c) => {
      const k = c.department_id || '__unassigned__';
      (grouped[k] ||= []).push(c);
    });
    expect(grouped['d1'].map((c) => c.id)).toEqual(['c1']);
    expect(grouped['d2'].map((c) => c.id)).toEqual(['c2']);
    expect(grouped['__unassigned__'].map((c) => c.id)).toEqual(['c3']);
  });

  it('chart with cross-department KPIs still appears only in its assigned department', () => {
    // Chart assigned to d1 but pulls KPIs from d1 and d2
    const chart = { id: 'c1', department_id: 'd1', kpi_chart_kpis: [
      { kpi: { department_id: 'd1' } },
      { kpi: { department_id: 'd2' } },
    ] };
    const grouped: Record<string, any[]> = {};
    const k = chart.department_id || '__unassigned__';
    (grouped[k] ||= []).push(chart);
    expect(grouped['d1']).toHaveLength(1);
    expect(grouped['d2']).toBeUndefined();
  });
});
