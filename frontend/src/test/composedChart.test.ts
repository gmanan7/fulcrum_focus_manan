import { describe, it, expect } from 'vitest';
import {
  computeKpiStatus,
  mergeComposedChartData,
  autoColor,
  clampSpan,
  COMPOSED_AUTO_PALETTE,
} from '@/lib/composedChart';

describe('computeKpiStatus — direction-aware', () => {
  it('higher_is_better: value ≥ green → green', () => {
    expect(computeKpiStatus(95, { green_threshold: 90, amber_threshold: 80, direction: 'higher_is_better' })).toBe('green');
  });
  it('higher_is_better: amber ≤ value < green → amber', () => {
    expect(computeKpiStatus(85, { green_threshold: 90, amber_threshold: 80, direction: 'higher_is_better' })).toBe('amber');
  });
  it('higher_is_better: value < amber → red', () => {
    expect(computeKpiStatus(70, { green_threshold: 90, amber_threshold: 80, direction: 'higher_is_better' })).toBe('red');
  });

  it('lower_is_better: value ≤ green → GREEN (not red)', () => {
    // Complaint count of 2 with green=5, amber=10 → green
    expect(computeKpiStatus(2, { green_threshold: 5, amber_threshold: 10, direction: 'lower_is_better' })).toBe('green');
  });
  it('lower_is_better: between thresholds → amber', () => {
    expect(computeKpiStatus(8, { green_threshold: 5, amber_threshold: 10, direction: 'lower_is_better' })).toBe('amber');
  });
  it('lower_is_better: value > amber → red', () => {
    expect(computeKpiStatus(15, { green_threshold: 5, amber_threshold: 10, direction: 'lower_is_better' })).toBe('red');
  });

  it('missing thresholds → gray', () => {
    expect(computeKpiStatus(50, { green_threshold: null, amber_threshold: null })).toBe('gray');
  });
  it('null value → gray', () => {
    expect(computeKpiStatus(null, { green_threshold: 90, amber_threshold: 80 })).toBe('gray');
  });
  it('defaults to higher_is_better when direction omitted', () => {
    expect(computeKpiStatus(95, { green_threshold: 90, amber_threshold: 80 })).toBe('green');
  });
});

describe('mergeComposedChartData — no roll-up across frequencies', () => {
  it('merges two KPIs at distinct dates without aggregation', () => {
    const merged = mergeComposedChartData(['a', 'b'], {
      a: [
        { kpi_id: 'a', reporting_date: '2026-06-01', actual_value: 10 },
        { kpi_id: 'a', reporting_date: '2026-06-02', actual_value: 12 },
      ],
      b: [
        // weekly KPI
        { kpi_id: 'b', reporting_date: '2026-06-01', actual_value: 80 },
      ],
    });
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual({ reporting_date: '2026-06-01', kpi_a: 10, kpi_b: 80 });
    // 2nd date has no entry for b — should be omitted from row
    expect(merged[1].reporting_date).toBe('2026-06-02');
    expect((merged[1] as any).kpi_a).toBe(12);
    expect((merged[1] as any).kpi_b).toBeUndefined();
  });
  it('sorts merged rows by date ascending', () => {
    const merged = mergeComposedChartData(['a'], {
      a: [
        { kpi_id: 'a', reporting_date: '2026-06-03', actual_value: 3 },
        { kpi_id: 'a', reporting_date: '2026-06-01', actual_value: 1 },
        { kpi_id: 'a', reporting_date: '2026-06-02', actual_value: 2 },
      ],
    });
    expect(merged.map((r) => r.reporting_date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });
  it('handles empty entries', () => {
    expect(mergeComposedChartData(['a'], { a: [] })).toEqual([]);
  });
  it('skips null actual_values', () => {
    const merged = mergeComposedChartData(['a'], {
      a: [{ kpi_id: 'a', reporting_date: '2026-06-01', actual_value: null }],
    });
    expect((merged[0] as any).kpi_a).toBeUndefined();
  });
});

describe('autoColor', () => {
  it('returns distinct colours for sequential display orders', () => {
    const c0 = autoColor(0);
    const c1 = autoColor(1);
    const c2 = autoColor(2);
    expect(c0).not.toBe(c1);
    expect(c1).not.toBe(c2);
    expect(COMPOSED_AUTO_PALETTE).toContain(c0);
  });
  it('cycles within palette', () => {
    expect(autoColor(0)).toBe(autoColor(COMPOSED_AUTO_PALETTE.length));
  });
});

describe('clampSpan', () => {
  it('mobile (1 col) always returns 1', () => {
    expect(clampSpan(3, 1)).toBe(1);
    expect(clampSpan(2, 1)).toBe(1);
  });
  it('clamps to column count', () => {
    expect(clampSpan(3, 2)).toBe(2);
    expect(clampSpan(2, 3)).toBe(2);
    expect(clampSpan(3, 4)).toBe(3);
  });
  it('floors below 1 to 1', () => {
    expect(clampSpan(0, 3)).toBe(1);
  });
});
