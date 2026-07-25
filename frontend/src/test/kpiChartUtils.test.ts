import { describe, it, expect } from 'vitest';
import { formatChartDate, getLineColour, getTooltipRagLabel, calculateDateRange, calculateYMax } from '@/lib/kpiChartUtils';
import { format, subDays } from 'date-fns';

describe('formatChartDate', () => {
  it('"2026-04-14" → "14 Apr"', () => {
    expect(formatChartDate('2026-04-14')).toBe('14 Apr');
  });
  it('"2026-01-01" → "01 Jan"', () => {
    expect(formatChartDate('2026-01-01')).toBe('01 Jan');
  });
});

describe('getLineColour', () => {
  it('green status → green token', () => {
    expect(getLineColour('green')).toBe('var(--rag-green)');
  });
  it('red status → red token', () => {
    expect(getLineColour('red')).toBe('var(--rag-red)');
  });
  it('null status → muted fallback', () => {
    expect(getLineColour(null)).toBe('var(--chart-line)');
  });
  it('empty data (undefined) → muted fallback', () => {
    expect(getLineColour(undefined)).toBe('var(--chart-line)');
  });
});

describe('getTooltipRagLabel', () => {
  it('value meets green threshold, higher_is_better → "On Target"', () => {
    expect(getTooltipRagLabel(100, 80, 90, 70, 'higher_is_better')).toBe('On Target');
  });
  it('value below amber threshold, higher_is_better → "Below Target"', () => {
    expect(getTooltipRagLabel(50, 80, 90, 70, 'higher_is_better')).toBe('Below Target');
  });
  it('value between amber and green, higher_is_better → "Near Target"', () => {
    expect(getTooltipRagLabel(75, 80, 90, 70, 'higher_is_better')).toBe('Near Target');
  });
  it('null target → "—"', () => {
    expect(getTooltipRagLabel(100, null, null, null, 'higher_is_better')).toBe('—');
  });
  it('null value → "—"', () => {
    expect(getTooltipRagLabel(null, 80, 90, 70, 'higher_is_better')).toBe('—');
  });
  it('lower_is_better, value below green → "On Target"', () => {
    expect(getTooltipRagLabel(5, 10, 8, 12, 'lower_is_better')).toBe('On Target');
  });
  it('lower_is_better, value above amber → "Above Target"', () => {
    expect(getTooltipRagLabel(15, 10, 8, 12, 'lower_is_better')).toBe('Above Target');
  });
});

describe('calculateDateRange', () => {
  const today = new Date('2026-04-16');

  it('7 days → startDate is today minus 7', () => {
    const result = calculateDateRange(7, today);
    expect(result.startDate).toBe(format(subDays(today, 7), 'yyyy-MM-dd'));
    expect(result.endDate).toBe(format(subDays(today, 1), 'yyyy-MM-dd'));
  });

  it('30 days → startDate is today minus 30', () => {
    const result = calculateDateRange(30, today);
    expect(result.startDate).toBe('2026-03-17');
  });

  it('90 days → startDate is today minus 90', () => {
    const result = calculateDateRange(90, today);
    expect(result.startDate).toBe('2026-01-16');
  });

  it('endDate is always yesterday', () => {
    const result = calculateDateRange(30, today);
    expect(result.endDate).toBe('2026-04-15');
  });
});

describe('calculateYMax', () => {
  it('data=[{value:100}], target=90 → 120', () => {
    expect(calculateYMax([{ value: 100 }], 90)).toBe(120);
  });
  it('data=[{value:50}], target=200 → 240', () => {
    expect(calculateYMax([{ value: 50 }], 200)).toBe(240);
  });
  it('data=[{value:50}], target=null → 60', () => {
    expect(calculateYMax([{ value: 50 }], null)).toBe(60);
  });
  it('data=[], target=null → 100 (fallback)', () => {
    expect(calculateYMax([], null)).toBe(100);
  });
  it('data=[], target=50 → 60', () => {
    expect(calculateYMax([], 50)).toBe(60);
  });
  it('data=[{value:null},{value:30}], target=null → 36', () => {
    expect(calculateYMax([{ value: null }, { value: 30 }], null)).toBe(36);
  });
  it('data=[{value:0}], target=0 → 100 (fallback)', () => {
    expect(calculateYMax([{ value: 0 }], 0)).toBe(100);
  });
  it('returns Math.ceil (no decimals)', () => {
    expect(calculateYMax([{ value: 33 }], null)).toBe(Math.ceil(33 * 1.2));
  });
});
