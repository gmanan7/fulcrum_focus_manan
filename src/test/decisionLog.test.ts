import { describe, it, expect } from 'vitest';
import { getDecisionTaskStatus } from '@/lib/utils';

describe('getDecisionTaskStatus', () => {
  it('returns no_task when no task is linked', () => {
    expect(getDecisionTaskStatus(null)).toBe('no_task');
  });

  it('returns resolved for a completed task', () => {
    expect(getDecisionTaskStatus({
      status: 'completed', due_date: '2026-04-01'
    })).toBe('resolved');
  });

  it('returns resolved for a cancelled task', () => {
    expect(getDecisionTaskStatus({
      status: 'cancelled', due_date: '2026-04-01'
    })).toBe('resolved');
  });

  it('returns overdue for a past-due open task', () => {
    expect(getDecisionTaskStatus({
      status: 'open', due_date: '2026-01-01'
    })).toBe('overdue');
  });

  it('returns overdue for a past-due in_progress task', () => {
    expect(getDecisionTaskStatus({
      status: 'in_progress', due_date: '2026-01-01'
    })).toBe('overdue');
  });

  it('returns active for a future-due open task', () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const futureStr = future.toISOString().split('T')[0];
    expect(getDecisionTaskStatus({
      status: 'open', due_date: futureStr
    })).toBe('active');
  });

  it('no_task is not the same as unresolved — verify label never appears', () => {
    expect(getDecisionTaskStatus(null)).not.toBe('unresolved');
  });
});
