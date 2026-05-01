import { describe, it, expect } from 'vitest';
import { isCarryover, filterCarryoverTasks } from '@/lib/taskCarryover';

describe('isCarryover', () => {
  const historyIds = new Set(['t1', 't2', 't3']);

  it('returns true when task id is in history and status is open', () => {
    expect(isCarryover({ id: 't1', status: 'open' }, historyIds)).toBe(true);
  });

  it('returns true when in history and in_progress', () => {
    expect(isCarryover({ id: 't2', status: 'in_progress' }, historyIds)).toBe(true);
  });

  it('returns false when completed even if in history', () => {
    expect(isCarryover({ id: 't1', status: 'completed' }, historyIds)).toBe(false);
  });

  it('returns false when cancelled even if in history', () => {
    expect(isCarryover({ id: 't2', status: 'cancelled' }, historyIds)).toBe(false);
  });

  it('returns false when not in history', () => {
    expect(isCarryover({ id: 'tX', status: 'open' }, historyIds)).toBe(false);
  });

  it('accepts an array of ids as well as a Set', () => {
    expect(isCarryover({ id: 't1', status: 'open' }, ['t1', 't2'])).toBe(true);
  });
});

describe('filterCarryoverTasks', () => {
  const tasks = [
    { id: 't1', status: 'open' },
    { id: 't2', status: 'completed' },
    { id: 't3', status: 'in_progress' },
    { id: 't4', status: 'open' }, // not in history
    { id: 't5', status: 'cancelled' },
  ];
  const historyIds = ['t1', 't2', 't3', 't5'];

  it('excludes completed and cancelled tasks from the count', () => {
    const result = filterCarryoverTasks(tasks, historyIds);
    expect(result.map((t) => t.id)).toEqual(['t1', 't3']);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterCarryoverTasks([{ id: 'z', status: 'open' }], historyIds)).toEqual([]);
  });
});
