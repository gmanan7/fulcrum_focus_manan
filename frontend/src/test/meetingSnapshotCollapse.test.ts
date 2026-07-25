import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildSnapshotCollapseSummary,
  getMeetingSnapshotCollapseKey,
  getDeptCollapseKey,
  setAllCollapseStates,
} from '@/lib/dashboardUtils';

describe('buildSnapshotCollapseSummary', () => {
  it('counts red, amber, green correctly', () => {
    const result = buildSnapshotCollapseSummary(['red', 'amber', 'green', 'green']);
    expect(result).toEqual({ total: 4, red: 1, amber: 1, green: 2, missing: 0 });
  });

  it('tracks missing when all statuses are null', () => {
    const result = buildSnapshotCollapseSummary([null, null, null]);
    expect(result).toEqual({ total: 3, red: 0, amber: 0, green: 0, missing: 3 });
  });
});

describe('getMeetingSnapshotCollapseKey', () => {
  it('namespaces key per department code', () => {
    expect(getMeetingSnapshotCollapseKey('PROD')).toBe('fulcrum-meeting-snapshot-collapse-PROD');
  });

  it('is distinct from dashboard collapse key', () => {
    expect(getMeetingSnapshotCollapseKey('PROD')).not.toBe(getDeptCollapseKey('PROD'));
  });
});

describe('setAllCollapseStates', () => {
  beforeEach(() => localStorage.clear());

  it('Collapse All sets all to true', () => {
    const result = setAllCollapseStates(['A', 'B', 'C'], true, getMeetingSnapshotCollapseKey);
    expect(result).toEqual({ A: true, B: true, C: true });
    expect(localStorage.getItem('fulcrum-meeting-snapshot-collapse-A')).toBe('true');
  });

  it('Expand All sets all to false', () => {
    const result = setAllCollapseStates(['A', 'B'], false, getMeetingSnapshotCollapseKey);
    expect(result).toEqual({ A: false, B: false });
    expect(localStorage.getItem('fulcrum-meeting-snapshot-collapse-A')).toBe('false');
  });
});
