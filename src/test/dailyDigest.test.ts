import { describe, it, expect, beforeEach } from 'vitest';
import {
  digestStorageKey,
  getGreeting,
  firstName,
  groupDigestTasks,
  daysOverdue,
  shouldShowDigest,
} from '@/lib/dailyDigest';

const u = 'user-1';

describe('dailyDigest', () => {
  beforeEach(() => localStorage.clear());

  it('greeting by hour', () => {
    expect(getGreeting(new Date('2026-05-06T08:00:00'))).toBe('Good morning');
    expect(getGreeting(new Date('2026-05-06T13:00:00'))).toBe('Good afternoon');
    expect(getGreeting(new Date('2026-05-06T20:00:00'))).toBe('Good evening');
  });

  it('firstName', () => {
    expect(firstName('Marut Shukla')).toBe('Marut');
    expect(firstName(null)).toBe('');
  });

  it('groups overdue + due today, ignores others', () => {
    const now = new Date('2026-05-06T10:00:00');
    const tasks = [
      { id: '1', title: 'a', owner_id: u, status: 'open', due_date: '2026-05-05' },
      { id: '2', title: 'b', owner_id: u, status: 'in_progress', due_date: '2026-05-06' },
      { id: '3', title: 'c', owner_id: u, status: 'completed', due_date: '2026-05-05' },
      { id: '4', title: 'd', owner_id: 'other', status: 'open', due_date: '2026-05-05' },
      { id: '5', title: 'e', owner_id: u, status: 'open', due_date: '2026-05-08' },
    ];
    const g = groupDigestTasks(tasks, u, now);
    expect(g.overdue.map((t) => t.id)).toEqual(['1']);
    expect(g.dueToday.map((t) => t.id)).toEqual(['2']);
  });

  it('daysOverdue', () => {
    const now = new Date('2026-05-06T10:00:00');
    expect(daysOverdue('2026-05-05', now)).toBe(1);
    expect(daysOverdue('2026-05-01', now)).toBe(5);
  });

  it('shouldShowDigest false when zero tasks', () => {
    expect(shouldShowDigest(0, localStorage)).toBe(false);
  });

  it('shouldShowDigest true once per day, false after dismissal', () => {
    const now = new Date('2026-05-06T08:00:00');
    expect(shouldShowDigest(2, localStorage, now)).toBe(true);
    localStorage.setItem(digestStorageKey(now), '1');
    expect(shouldShowDigest(2, localStorage, now)).toBe(false);
  });

  it('shouldShowDigest re-shown next day', () => {
    const day1 = new Date('2026-05-06T08:00:00');
    localStorage.setItem(digestStorageKey(day1), '1');
    const day2 = new Date('2026-05-07T08:00:00');
    expect(shouldShowDigest(1, localStorage, day2)).toBe(true);
  });
});
