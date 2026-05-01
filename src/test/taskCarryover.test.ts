import { describe, it, expect } from 'vitest';
import { isCarryover, filterCarryoverTasks } from '@/lib/taskCarryover';

describe('carryover ids built from task_updates rows', () => {
  it('deduplicates 3 rows across 2 distinct task ids', () => {
    const rows = [
      { task_id: 'a', update_type: 'due_date_change' },
      { task_id: 'a', update_type: 'due_date_change' },
      { task_id: 'b', update_type: 'due_date_change' },
    ];
    const ids = new Set(rows.map((r) => r.task_id));
    expect(ids.size).toBe(2);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
  });

  it('produces an empty set when there are no due_date_change rows', () => {
    const rows: { task_id: string }[] = [];
    const ids = new Set(rows.map((r) => r.task_id));
    expect(ids.size).toBe(0);
  });

  it('isCarryover returns true for open task whose id is in the deduped set', () => {
    const rows = [
      { task_id: 't1', update_type: 'due_date_change' },
      { task_id: 't1', update_type: 'due_date_change' },
    ];
    const ids = new Set(rows.map((r) => r.task_id));
    expect(isCarryover({ id: 't1', status: 'open' }, ids)).toBe(true);
  });
});

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
