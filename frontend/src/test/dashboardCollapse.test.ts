import { describe, it, expect } from 'vitest';
import { buildCollapseSummary, getDeptCollapseKey } from '@/lib/dashboardUtils';

describe('buildCollapseSummary', () => {
  it('counts red, amber, green correctly', () => {
    const result = buildCollapseSummary(['red', 'red', 'amber', 'green', 'green', 'green']);
    expect(result).toEqual({ total: 6, red: 2, amber: 1, green: 3 });
  });

  it('handles all nulls (no entries)', () => {
    const result = buildCollapseSummary([null, null, null]);
    expect(result).toEqual({ total: 3, red: 0, amber: 0, green: 0 });
  });

  it('handles empty array', () => {
    const result = buildCollapseSummary([]);
    expect(result).toEqual({ total: 0, red: 0, amber: 0, green: 0 });
  });

  it('handles mixed with nulls', () => {
    const result = buildCollapseSummary(['red', null, 'green']);
    expect(result).toEqual({ total: 3, red: 1, amber: 0, green: 1 });
  });
});

describe('getDeptCollapseKey', () => {
  it('namespaces key per department code', () => {
    expect(getDeptCollapseKey('PROD')).toBe('fulcrum-dept-collapse-PROD');
  });

  it('produces different keys for different codes', () => {
    expect(getDeptCollapseKey('QA')).not.toBe(getDeptCollapseKey('HR'));
  });
});
