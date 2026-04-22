import { describe, it, expect } from 'vitest';
import { calculateMtd } from '@/lib/mtdUtils';

// Reference date locked inside April 2026
const REF = new Date(2026, 3, 15); // 15-Apr-2026

const sameMonth = [
  { reporting_date: '2026-04-01', actual_value: 10 },
  { reporting_date: '2026-04-05', actual_value: 20 },
  { reporting_date: '2026-04-10', actual_value: 30 },
];

describe('calculateMtd', () => {
  it('sum: [10, 20, 30] → 60', () => {
    expect(calculateMtd(sameMonth, 'sum', REF)).toBe(60);
  });

  it('average: [10, 20, 30] → 20', () => {
    expect(calculateMtd(sameMonth, 'average', REF)).toBe(20);
  });

  it('weighted_average: [10, 20, 30] → 20 (same as average for now)', () => {
    expect(calculateMtd(sameMonth, 'weighted_average', REF)).toBe(20);
  });

  it('sum ignores null entries: [10, null, 30] → 40', () => {
    const mixed = [
      { reporting_date: '2026-04-01', actual_value: 10 },
      { reporting_date: '2026-04-05', actual_value: null },
      { reporting_date: '2026-04-10', actual_value: 30 },
    ];
    expect(calculateMtd(mixed, 'sum', REF)).toBe(40);
  });

  it('average ignores null entries: [10, null, 30] → 20 (2 valid)', () => {
    const mixed = [
      { reporting_date: '2026-04-01', actual_value: 10 },
      { reporting_date: '2026-04-05', actual_value: null },
      { reporting_date: '2026-04-10', actual_value: 30 },
    ];
    expect(calculateMtd(mixed, 'average', REF)).toBe(20);
  });

  it('empty array → null regardless of aggregation', () => {
    expect(calculateMtd([], 'sum', REF)).toBeNull();
    expect(calculateMtd([], 'average', REF)).toBeNull();
    expect(calculateMtd([], 'weighted_average', REF)).toBeNull();
  });

  it('previous-month entries are excluded', () => {
    const mixed = [
      { reporting_date: '2026-03-30', actual_value: 100 }, // previous month
      ...sameMonth,
    ];
    expect(calculateMtd(mixed, 'sum', REF)).toBe(60);
  });

  it('referenceDate caps the upper bound', () => {
    // ref = 5 Apr → only entries on/before 5 Apr count
    const ref5 = new Date(2026, 3, 5);
    expect(calculateMtd(sameMonth, 'sum', ref5)).toBe(30); // 10 + 20
  });

  it("regression: MWH unit with aggregation='sum' returns sum not average", () => {
    // unit is now irrelevant — only aggregation matters
    expect(calculateMtd(sameMonth, 'sum', REF)).toBe(60);
  });

  it("regression: % unit with aggregation='average' returns average not sum", () => {
    expect(calculateMtd(sameMonth, 'average', REF)).toBe(20);
  });
});
