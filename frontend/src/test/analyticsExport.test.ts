import { describe, it, expect } from 'vitest';
import {
  generateAnalyticsFilename,
  buildExecutiveSummary,
} from '@/lib/analyticsExport';

describe('generateAnalyticsFilename', () => {
  it('formats with YYYY-MM-DD and ITC_PPB_NPF suffix', () => {
    const d = new Date(2026, 3, 23); // 23 Apr 2026
    expect(generateAnalyticsFilename(d)).toBe(
      'Analytics_Report_2026-04-23_ITC_PPB_NPF.pdf',
    );
  });
  it('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5); // 5 Jan 2026
    expect(generateAnalyticsFilename(d)).toBe(
      'Analytics_Report_2026-01-05_ITC_PPB_NPF.pdf',
    );
  });
});

describe('buildExecutiveSummary', () => {
  it('returns all four categories', () => {
    const s = buildExecutiveSummary({});
    expect(s).toHaveProperty('inactiveUsers');
    expect(s).toHaveProperty('lowComplianceDepts');
    expect(s).toHaveProperty('pushbackTasks');
    expect(s).toHaveProperty('zeroTaskMeetingsThisWeek');
  });
  it('returns empty arrays when no inactive users', () => {
    const s = buildExecutiveSummary({ inactiveUsers: [] });
    expect(s.inactiveUsers).toEqual([]);
  });
  it('returns array of length 3 for 3 non-compliant depts', () => {
    const s = buildExecutiveSummary({
      lowComplianceDepts: [
        { id: '1', name: 'A', compliance: 10 },
        { id: '2', name: 'B', compliance: 20 },
        { id: '3', name: 'C', compliance: 30 },
      ],
    });
    expect(s.lowComplianceDepts).toHaveLength(3);
  });
  it('defaults zeroTaskMeetingsThisWeek to 0', () => {
    expect(buildExecutiveSummary({}).zeroTaskMeetingsThisWeek).toBe(0);
  });
  it('preserves provided pushback tasks', () => {
    const s = buildExecutiveSummary({
      pushbackTasks: [{ id: 't1', title: 'Fix line 3', pushbacks: 4 }],
    });
    expect(s.pushbackTasks).toHaveLength(1);
    expect(s.pushbackTasks[0].title).toBe('Fix line 3');
  });
});
