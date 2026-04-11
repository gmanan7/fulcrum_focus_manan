import { describe, it, expect } from 'vitest';
import { getMeetingKpiReportingDate } from '@/lib/utils';

describe('getMeetingKpiReportingDate', () => {
  it('returns the day before a given meeting date', () => {
    expect(getMeetingKpiReportingDate('2026-04-11')).toBe('2026-04-10');
  });

  it('handles month boundaries correctly', () => {
    expect(getMeetingKpiReportingDate('2026-04-01')).toBe('2026-03-31');
  });

  it('handles year boundaries correctly', () => {
    expect(getMeetingKpiReportingDate('2026-01-01')).toBe('2025-12-31');
  });

  it('handles leap year February', () => {
    expect(getMeetingKpiReportingDate('2024-03-01')).toBe('2024-02-29');
  });
});
