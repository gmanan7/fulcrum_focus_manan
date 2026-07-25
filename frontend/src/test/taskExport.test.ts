import { describe, it, expect } from 'vitest';
import {
  buildTaskExportRow,
  generateTaskFilename,
  formatDateDDMMYYYY,
  calculateDaysOverdue,
  sortTasksForExport,
  type TaskExportInput,
} from '@/lib/taskExport';

const baseTask: TaskExportInput = {
  id: 't1',
  title: 'Inspect line 3',
  status: 'open',
  priority: 'high',
  due_date: '2026-04-20',
  created_at: '2026-04-10T08:00:00Z',
  is_private: false,
  task_group_id: null,
  owner_id: 'u1',
  created_by: 'u2',
  owner: { full_name: 'Alice Doe' },
  dept: { name: 'Production' },
};

describe('formatDateDDMMYYYY', () => {
  it('formats ISO date', () => {
    expect(formatDateDDMMYYYY('2026-04-23')).toBe('23/04/2026');
  });
  it('returns empty for null/invalid', () => {
    expect(formatDateDDMMYYYY(null)).toBe('');
    expect(formatDateDDMMYYYY('not-a-date')).toBe('');
  });
});

describe('calculateDaysOverdue', () => {
  const ref = new Date('2026-04-25T12:00:00Z');
  it('returns positive days for overdue open tasks', () => {
    expect(calculateDaysOverdue('2026-04-20', 'open', ref)).toBe(5);
  });
  it('returns blank when not overdue', () => {
    expect(calculateDaysOverdue('2026-04-30', 'open', ref)).toBe('');
  });
  it('returns blank for completed/cancelled', () => {
    expect(calculateDaysOverdue('2026-04-01', 'completed', ref)).toBe('');
    expect(calculateDaysOverdue('2026-04-01', 'cancelled', ref)).toBe('');
  });
  it('returns blank when no due date', () => {
    expect(calculateDaysOverdue(null, 'open', ref)).toBe('');
  });
});

describe('buildTaskExportRow', () => {
  it('maps all columns correctly', () => {
    const row = buildTaskExportRow(baseTask, {
      pushCounts: new Map([['t1', 2]]),
      userNameById: new Map([['u2', 'Bob Smith']]),
      reference: new Date('2026-04-25T12:00:00Z'),
    });
    expect(row).toEqual({
      'Task Title': 'Inspect line 3',
      Status: 'Open',
      Priority: 'High',
      Department: 'Production',
      'Assigned To': 'Alice Doe',
      'Assigned By': 'Bob Smith',
      'Due Date': '20/04/2026',
      'Created Date': '10/04/2026',
      'Days Overdue': 5,
      'Due Date Changes': 2,
      'Group/Team': '',
      Private: 'No',
    });
  });

  it('shows days overdue for overdue tasks', () => {
    const row = buildTaskExportRow(
      { ...baseTask, due_date: '2026-04-15' },
      { reference: new Date('2026-04-25T12:00:00Z') },
    );
    expect(row['Days Overdue']).toBe(10);
  });

  it('blank days overdue for non-overdue task', () => {
    const row = buildTaskExportRow(
      { ...baseTask, due_date: '2026-05-01' },
      { reference: new Date('2026-04-25T12:00:00Z') },
    );
    expect(row['Days Overdue']).toBe('');
  });

  it('shows Yes in Private column for private task', () => {
    const row = buildTaskExportRow({ ...baseTask, is_private: true });
    expect(row.Private).toBe('Yes');
  });

  it('maps group name when task has a group', () => {
    const row = buildTaskExportRow(
      { ...baseTask, task_group_id: 'g1' },
      { groupNameById: new Map([['g1', 'Alpha Team']]) },
    );
    expect(row['Group/Team']).toBe('Alpha Team');
  });

  it('blank group when no group', () => {
    const row = buildTaskExportRow(baseTask);
    expect(row['Group/Team']).toBe('');
  });

  it('defaults Due Date Changes to 0 when not in pushCounts', () => {
    const row = buildTaskExportRow(baseTask);
    expect(row['Due Date Changes']).toBe(0);
  });
});

describe('sortTasksForExport', () => {
  it('sorts by status order then due date ascending', () => {
    const tasks = [
      { id: 'a', status: 'completed', due_date: '2026-04-01' },
      { id: 'b', status: 'open', due_date: '2026-04-20' },
      { id: 'c', status: 'open', due_date: '2026-04-10' },
      { id: 'd', status: 'in_progress', due_date: '2026-04-15' },
    ];
    const sorted = sortTasksForExport(tasks);
    expect(sorted.map((t) => t.id)).toEqual(['c', 'b', 'd', 'a']);
  });
});

describe('generateTaskFilename', () => {
  it('returns filename in expected format', () => {
    expect(generateTaskFilename(new Date('2026-04-23T00:00:00'))).toBe(
      'Tasks_23-Apr-2026_FulcrumFocus.xlsx',
    );
  });
});

describe('Export scope respects filters', () => {
  // The scope selection happens at the call site by passing either filtered
  // (current view) or unfiltered (all) tasks into the export. This test
  // documents that contract: buildTaskExportRow does not re-apply filters.
  it('builds rows for whatever list it receives', () => {
    const list = [baseTask, { ...baseTask, id: 't2', title: 'Other' }];
    const rows = list.map((t) => buildTaskExportRow(t));
    expect(rows).toHaveLength(2);
    expect(rows[1]['Task Title']).toBe('Other');
  });
});
