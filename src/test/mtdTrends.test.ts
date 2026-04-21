import { describe, it, expect } from 'vitest';
import { calculateMtd, getAggregationType } from '@/lib/mtdUtils';

describe('getAggregationType', () => {
  it("returns 'average' for %", () => expect(getAggregationType('%')).toBe('average'));
  it("returns 'sum' for L Sheets", () => expect(getAggregationType('L Sheets')).toBe('sum'));
  it("returns 'average' for MWH", () => expect(getAggregationType('MWH')).toBe('average'));
  it("returns 'average' for Days", () => expect(getAggregationType('Days')).toBe('average'));
  it("returns 'sum' for Nos", () => expect(getAggregationType('Nos')).toBe('sum'));
  it("returns 'sum' for unknown unit", () => expect(getAggregationType('Foo')).toBe('sum'));
  it("returns 'sum' for null", () => expect(getAggregationType(null)).toBe('sum'));
  it('is case-insensitive', () => expect(getAggregationType('mwh')).toBe('average'));
});

describe('calculateMtd', () => {
  const currentMonth = '2026-04';
  const entries = [
    { actual_value: 100, reporting_date: '2026-03-30' }, // prev month — ignored
    { actual_value: 50, reporting_date: '2026-04-01' },
    { actual_value: 75, reporting_date: '2026-04-05' },
    { actual_value: 25, reporting_date: '2026-04-10' },
  ];

  it("'sum' adds only current-month entries", () => {
    expect(calculateMtd(entries, 'sum', currentMonth)).toBe(150);
  });

  it("'average' averages only current-month entries", () => {
    expect(calculateMtd(entries, 'average', currentMonth)).toBe(50);
  });

  it('returns null when entries array is empty', () => {
    expect(calculateMtd([], 'sum', currentMonth)).toBeNull();
  });

  it('returns null when no entries fall in current month', () => {
    const prevOnly = [{ actual_value: 10, reporting_date: '2026-03-15' }];
    expect(calculateMtd(prevOnly, 'sum', currentMonth)).toBeNull();
  });

  it('skips null actual_values', () => {
    const mixed = [
      { actual_value: null, reporting_date: '2026-04-01' },
      { actual_value: 20, reporting_date: '2026-04-02' },
    ];
    expect(calculateMtd(mixed, 'average', currentMonth)).toBe(20);
  });
});
