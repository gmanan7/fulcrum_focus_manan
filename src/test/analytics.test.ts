import { describe, it, expect } from 'vitest';
import {
  calculateComplianceRate,
  getActivityStatus,
  getActivityScore,
  daysSince,
  resolvePeriodRange,
  workingDaysElapsed,
} from '@/lib/analytics';
import { formatBadgeCount } from '@/lib/navBadge';

describe('calculateComplianceRate', () => {
  it('returns 0 when expected is 0', () => {
    expect(calculateComplianceRate(0, 0)).toBe(0);
    expect(calculateComplianceRate(5, 0)).toBe(0);
  });
  it('returns 0 when actual is 0', () => {
    expect(calculateComplianceRate(0, 10)).toBe(0);
  });
  it('returns 100 when fully compliant', () => {
    expect(calculateComplianceRate(10, 10)).toBe(100);
  });
  it('returns 70 for 7/10', () => {
    expect(calculateComplianceRate(7, 10)).toBe(70);
  });
  it('clamps over-100', () => {
    expect(calculateComplianceRate(15, 10)).toBe(100);
  });
});

describe('getActivityStatus', () => {
  it('returns active for recent activity', () => {
    expect(getActivityStatus(0)).toBe('active');
    expect(getActivityStatus(1)).toBe('active');
    expect(getActivityStatus(3)).toBe('active');
  });
  it('returns idle for 4..14 days', () => {
    expect(getActivityStatus(4)).toBe('idle');
    expect(getActivityStatus(10)).toBe('idle');
    expect(getActivityStatus(14)).toBe('idle');
  });
  it('returns inactive for 15+ days', () => {
    expect(getActivityStatus(15)).toBe('inactive');
    expect(getActivityStatus(20)).toBe('inactive');
  });
  it('returns never when null', () => {
    expect(getActivityStatus(null)).toBe('never');
    expect(getActivityStatus(undefined)).toBe('never');
  });
});

describe('getActivityScore', () => {
  it('sums all action counts', () => {
    expect(getActivityScore(5, 3, 2)).toBe(10);
  });
  it('handles zeros', () => {
    expect(getActivityScore(0, 0, 0)).toBe(0);
  });
});

describe('daysSince', () => {
  it('returns null for empty input', () => {
    expect(daysSince(null)).toBeNull();
    expect(daysSince(undefined)).toBeNull();
  });
  it('counts full days', () => {
    const now = new Date('2026-04-22T12:00:00Z');
    const five = new Date('2026-04-17T12:00:00Z').toISOString();
    expect(daysSince(five, now)).toBe(5);
  });
});

describe('resolvePeriodRange', () => {
  const now = new Date('2026-04-22T12:00:00Z');
  it('all_time has null start', () => {
    expect(resolvePeriodRange('all_time', now).start).toBeNull();
  });
  it('last_7 starts 7 days back', () => {
    const r = resolvePeriodRange('last_7', now);
    expect(new Date(r.start!).toISOString().slice(0, 10)).toBe('2026-04-15');
  });
  it('this_month starts on the 1st', () => {
    const r = resolvePeriodRange('this_month', now);
    expect(new Date(r.start!).getDate()).toBe(1);
  });
});

describe('workingDaysElapsed', () => {
  it('skips weekends', () => {
    // Mon 2026-04-20 .. Fri 2026-04-24 = 5 working days
    const start = new Date(2026, 3, 20);
    const end = new Date(2026, 3, 24);
    expect(workingDaysElapsed(start, end)).toBe(5);
  });
  it('returns 0 if today is before start', () => {
    expect(workingDaysElapsed(new Date(2026, 3, 22), new Date(2026, 3, 20))).toBe(0);
  });
});

describe('formatBadgeCount reuse', () => {
  it('returns null for 0', () => {
    expect(formatBadgeCount(0)).toBeNull();
  });
});
