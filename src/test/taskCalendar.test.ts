import { describe, it, expect } from 'vitest';
import {
  getDateColumns,
  getDefaultWindowStart,
  getTaskState,
  groupTasksByDeptAndOwner,
  filterTasksInRange,
  tasksForCell,
  dateKey,
  isWeekend,
} from '@/lib/taskCalendar';

const today = new Date('2026-05-06T12:00:00');

describe('taskCalendar', () => {
  it('generates correct number of date columns', () => {
    expect(getDateColumns(today, 7)).toHaveLength(7);
    expect(getDateColumns(today, 14)).toHaveLength(14);
    expect(getDateColumns(today, 28)).toHaveLength(28);
  });

  it('default window starts 3 days before today', () => {
    const start = getDefaultWindowStart(today, 14);
    expect(dateKey(start)).toBe('2026-05-03');
  });

  it('classifies task states', () => {
    expect(getTaskState({ id: '1', due_date: '2026-05-05', status: 'open' }, today)).toBe('overdue');
    expect(getTaskState({ id: '2', due_date: '2026-05-06', status: 'open' }, today)).toBe('today');
    expect(getTaskState({ id: '3', due_date: '2026-05-08', status: 'open' }, today)).toBe('future');
    expect(getTaskState({ id: '4', due_date: '2026-05-05', status: 'completed' }, today)).toBe('closed');
    expect(getTaskState({ id: '5', due_date: '2026-05-05', status: 'cancelled' }, today)).toBe('closed');
  });

  it('detects weekends', () => {
    expect(isWeekend(new Date('2026-05-09T00:00:00'))).toBe(true); // Sat
    expect(isWeekend(new Date('2026-05-10T00:00:00'))).toBe(true); // Sun
    expect(isWeekend(new Date('2026-05-06T00:00:00'))).toBe(false); // Wed
  });

  it('groups tasks by department then owner', () => {
    const tasks = [
      { id: 'a', department_id: 'd1', owner_id: 'u1', dept: { name: 'Ops' }, owner: { full_name: 'Alice' } },
      { id: 'b', department_id: 'd1', owner_id: 'u2', dept: { name: 'Ops' }, owner: { full_name: 'Bob' } },
      { id: 'c', department_id: 'd2', owner_id: 'u3', dept: { name: 'Eng' }, owner: { full_name: 'Carol' } },
      { id: 'd', department_id: 'd1', owner_id: 'u1', dept: { name: 'Ops' }, owner: { full_name: 'Alice' } },
    ];
    const grouped = groupTasksByDeptAndOwner(tasks);
    expect(grouped).toHaveLength(2);
    const ops = grouped.find((g) => g.deptName === 'Ops')!;
    expect(ops.owners).toHaveLength(2);
    const alice = ops.owners.find((o) => o.ownerName === 'Alice')!;
    expect(alice.tasks).toHaveLength(2);
  });

  it('filters tasks whose due_date is inside the visible columns', () => {
    const cols = getDateColumns(new Date('2026-05-03T00:00:00'), 14);
    const tasks = [
      { id: '1', due_date: '2026-05-05' },
      { id: '2', due_date: '2026-05-30' }, // out
      { id: '3', due_date: null }, // no date
    ];
    const filtered = filterTasksInRange(tasks, cols);
    expect(filtered.map((t) => t.id)).toEqual(['1']);
  });

  it('returns tasks for a specific cell key', () => {
    const owner = {
      ownerId: 'u1',
      ownerName: 'Alice',
      tasks: [
        { id: 'a', due_date: '2026-05-06' },
        { id: 'b', due_date: '2026-05-06' },
        { id: 'c', due_date: '2026-05-07' },
      ],
    };
    expect(tasksForCell(owner, '2026-05-06')).toHaveLength(2);
    expect(tasksForCell(owner, '2026-05-07')).toHaveLength(1);
    expect(tasksForCell(owner, '2026-05-08')).toHaveLength(0);
  });
});
