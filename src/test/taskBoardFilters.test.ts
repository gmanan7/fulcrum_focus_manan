import { describe, it, expect } from 'vitest';
import { isTaskOverdue, isTaskDueToday } from '@/lib/utils';
import { format, subDays, addDays } from 'date-fns';

const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
const today = new Date();
today.setHours(0, 0, 0, 0);

describe('isTaskOverdue', () => {
  it('returns true for yesterday + open', () => {
    expect(isTaskOverdue({ due_date: fmt(subDays(today, 1)), status: 'open' })).toBe(true);
  });
  it('returns false for yesterday + completed', () => {
    expect(isTaskOverdue({ due_date: fmt(subDays(today, 1)), status: 'completed' })).toBe(false);
  });
  it('returns false for tomorrow', () => {
    expect(isTaskOverdue({ due_date: fmt(addDays(today, 1)), status: 'open' })).toBe(false);
  });
  it('returns false for today', () => {
    expect(isTaskOverdue({ due_date: fmt(today), status: 'open' })).toBe(false);
  });
});

describe('isTaskDueToday', () => {
  it('returns true for today + in_progress', () => {
    expect(isTaskDueToday({ due_date: fmt(today), status: 'in_progress' })).toBe(true);
  });
  it('returns false for tomorrow', () => {
    expect(isTaskDueToday({ due_date: fmt(addDays(today, 1)), status: 'open' })).toBe(false);
  });
  it('returns false for today + completed', () => {
    expect(isTaskDueToday({ due_date: fmt(today), status: 'completed' })).toBe(false);
  });
});

describe('both filters active simultaneously', () => {
  it('a task cannot be both overdue and due today', () => {
    const task = { due_date: fmt(subDays(today, 1)), status: 'open' };
    const matchesBoth = isTaskOverdue(task) && isTaskDueToday(task);
    expect(matchesBoth).toBe(false);
  });
});
