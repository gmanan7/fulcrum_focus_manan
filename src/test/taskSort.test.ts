import { describe, it, expect } from 'vitest';
import { format, addDays, subDays } from 'date-fns';
import { formatDueDate, sortTasks } from '@/lib/taskSort';

const today = new Date(); today.setHours(0, 0, 0, 0);
const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

describe('formatDueDate', () => {
  it('returns null for null input', () => {
    expect(formatDueDate(null)).toBeNull();
    expect(formatDueDate(undefined)).toBeNull();
  });
  it('formats yesterday as Overdue by 1 day', () => {
    expect(formatDueDate(fmt(subDays(today, 1)), today)).toBe('Overdue by 1 day');
  });
  it('formats 3 days ago as Overdue by 3 days', () => {
    expect(formatDueDate(fmt(subDays(today, 3)), today)).toBe('Overdue by 3 days');
  });
  it('formats today as Due today', () => {
    expect(formatDueDate(fmt(today), today)).toBe('Due today');
  });
  it('formats tomorrow as Due: D MMM', () => {
    const tomorrow = addDays(today, 1);
    expect(formatDueDate(fmt(tomorrow), today)).toBe(`Due: ${format(tomorrow, 'd MMM')}`);
  });
});

describe('sortTasks', () => {
  const tasks = [
    { id: 'a', created_at: '2026-04-01T10:00:00Z', due_date: '2026-04-20' },
    { id: 'b', created_at: '2026-04-02T10:00:00Z', due_date: null },
    { id: 'c', created_at: '2026-04-03T10:00:00Z', due_date: '2026-04-10' },
    { id: 'd', created_at: '2026-04-04T10:00:00Z', due_date: '2026-04-15' },
  ];

  it('sorts created_desc (newest first)', () => {
    const r = sortTasks(tasks, 'created_desc').map((t) => t.id);
    expect(r).toEqual(['d', 'c', 'b', 'a']);
  });
  it('sorts created_asc (oldest first)', () => {
    const r = sortTasks(tasks, 'created_asc').map((t) => t.id);
    expect(r).toEqual(['a', 'b', 'c', 'd']);
  });
  it('sorts due_asc with nulls last', () => {
    const r = sortTasks(tasks, 'due_asc').map((t) => t.id);
    expect(r).toEqual(['c', 'd', 'a', 'b']);
  });
  it('sorts due_desc with nulls first', () => {
    const r = sortTasks(tasks, 'due_desc').map((t) => t.id);
    expect(r).toEqual(['b', 'a', 'd', 'c']);
  });
  it('does not mutate input', () => {
    const copy = [...tasks];
    sortTasks(tasks, 'due_asc');
    expect(tasks).toEqual(copy);
  });
});
