import { describe, it, expect } from 'vitest';
import { filterMyTasks } from '@/lib/myTasksFilter';
import { isTaskOverdue } from '@/lib/utils';
import { format, subDays } from 'date-fns';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const today = new Date();
today.setHours(0, 0, 0, 0);
const yesterday = fmt(subDays(today, 1));

describe('filterMyTasks', () => {
  const userId = 'user-1';
  const tasks = [
    { id: '1', owner_id: 'user-1', status: 'open' },
    { id: '2', owner_id: 'user-2', status: 'open' },
    { id: '3', owner_id: 'user-1', status: 'completed' },
    { id: '4', owner_id: 'user-1', status: 'cancelled' },
    { id: '5', owner_id: 'user-1', status: 'in_progress' },
  ];

  it('returns only tasks where owner_id matches userId', () => {
    const result = filterMyTasks(tasks, userId);
    expect(result.every((t) => t.owner_id === userId)).toBe(true);
  });

  it('excludes completed tasks', () => {
    const result = filterMyTasks(tasks, userId);
    expect(result.find((t) => t.id === '3')).toBeUndefined();
  });

  it('excludes cancelled tasks', () => {
    const result = filterMyTasks(tasks, userId);
    expect(result.find((t) => t.id === '4')).toBeUndefined();
  });

  it('returns empty array for empty input', () => {
    expect(filterMyTasks([], userId)).toEqual([]);
  });

  it('returns empty array when userId is null', () => {
    expect(filterMyTasks(tasks, null)).toEqual([]);
  });
});

describe('My Tasks + Overdue combined', () => {
  it('returns only tasks owned by user AND overdue', () => {
    const userId = 'user-1';
    const tasks = [
      { id: '1', owner_id: 'user-1', status: 'open', due_date: yesterday }, // mine + overdue
      { id: '2', owner_id: 'user-2', status: 'open', due_date: yesterday }, // overdue but not mine
      { id: '3', owner_id: 'user-1', status: 'open', due_date: fmt(today) }, // mine, not overdue
    ];
    const result = filterMyTasks(tasks, userId).filter(isTaskOverdue);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});
