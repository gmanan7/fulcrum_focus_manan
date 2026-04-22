import { describe, it, expect } from 'vitest';
import { formatActivityItem, sortActivityOldestFirst } from '@/lib/taskActivity';

describe('formatActivityItem', () => {
  it('status_change shows both statuses', () => {
    const txt = formatActivityItem('status_change', 'open', 'in_progress', null);
    expect(txt).toContain('open');
    expect(txt).toContain('in progress');
  });

  it('comment returns the comment text', () => {
    const txt = formatActivityItem('comment', null, null, 'Great work');
    expect(txt).toBe('Great work');
  });

  it('due_date_change with both dates', () => {
    const txt = formatActivityItem(
      'due_date_change', null, null, null, '2026-04-10', '2026-04-20',
    );
    expect(txt).toBe('changed due date from 10 Apr 2026 to 20 Apr 2026');
  });

  it('due_date_change with no previous date', () => {
    const txt = formatActivityItem(
      'due_date_change', null, null, null, null, '2026-04-20',
    );
    expect(txt).toBe('set due date to 20 Apr 2026');
  });
});

describe('sortActivityOldestFirst', () => {
  it('sorts comments oldest first', () => {
    const sorted = sortActivityOldestFirst([
      { id: 'b', created_at: '2026-04-15T10:00:00Z' },
      { id: 'a', created_at: '2026-04-10T10:00:00Z' },
      { id: 'c', created_at: '2026-04-20T10:00:00Z' },
    ]);
    expect(sorted.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('empty array returns empty', () => {
    expect(sortActivityOldestFirst([])).toEqual([]);
  });
});
