import { describe, it, expect } from 'vitest';
import { computeMtdValue, getMtdDateRange, isSumKpi } from '@/lib/mtdUtils';

describe('getMtdDateRange', () => {
  it('starts from 1st of the month', () => {
    const range = getMtdDateRange('2026-04-13');
    expect(range.from).toBe('2026-04-01');
  });

  it('ends on the reference date (inclusive)', () => {
    const range = getMtdDateRange('2026-04-13');
    expect(range.to).toBe('2026-04-13');
  });

  it('works on the 1st of month (from === to)', () => {
    const range = getMtdDateRange('2026-04-01');
    expect(range.from).toBe('2026-04-01');
    expect(range.to).toBe('2026-04-01');
  });
});

describe('computeMtdValue', () => {
  it('returns sum for output KPI given 3 daily entries', () => {
    const entries = [
      { actual_value: 100 },
      { actual_value: 150 },
      { actual_value: 200 },
    ];
    const result = computeMtdValue(entries, 'numeric', 'Nos');
    expect(result).toBe(450);
  });

  it('returns average for percentage KPI given 3 daily entries', () => {
    const entries = [
      { actual_value: 90 },
      { actual_value: 80 },
      { actual_value: 70 },
    ];
    const result = computeMtdValue(entries, 'numeric', '%');
    expect(result).toBe(80);
  });

  it('returns null when no entries exist in range', () => {
    const result = computeMtdValue([], 'numeric', 'Nos');
    expect(result).toBeNull();
  });

  it('returns null when all entries have null actual_value', () => {
    const entries = [{ actual_value: null }, { actual_value: null }];
    const result = computeMtdValue(entries, 'numeric', '%');
    expect(result).toBeNull();
  });

  it('returns sum for hrs unit (case insensitive)', () => {
    const entries = [{ actual_value: 8 }, { actual_value: 7 }];
    expect(computeMtdValue(entries, 'numeric', 'Hrs')).toBe(15);
  });

  it('returns average for Days unit', () => {
    const entries = [{ actual_value: 3 }, { actual_value: 5 }];
    expect(computeMtdValue(entries, 'numeric', 'Days')).toBe(4);
  });
});

describe('isSumKpi', () => {
  it('returns true for Nos', () => expect(isSumKpi('numeric', 'Nos')).toBe(true));
  it('returns false for %', () => expect(isSumKpi('numeric', '%')).toBe(false));
  it('returns false for descriptive', () => expect(isSumKpi('descriptive', 'Nos')).toBe(false));
});
