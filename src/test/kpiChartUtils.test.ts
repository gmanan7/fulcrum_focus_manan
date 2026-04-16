import { describe, it, expect } from 'vitest';
import { formatChartDate, getLineColour, getTooltipRagLabel } from '@/lib/kpiChartUtils';

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
