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

  it('title_change describes title update', () => {
    const txt = formatActivityItem(
      'title_change', null, null, null, null, null, 'Old title', 'New title',
    );
    expect(txt).toBe('changed the task title');
  });

  it('description_change describes description update with no body', () => {
    const txt = formatActivityItem(
      'description_change', null, null, null, null, null, 'Old desc', 'New desc',
    );
    expect(txt).toBe('updated the description');
    expect(txt).not.toContain('Old desc');
    expect(txt).not.toContain('New desc');
  });

  it('assignee_change with previous assignee → reassigned', () => {
    const txt = formatActivityItem(
      'assignee_change', null, null, null, null, null, 'Marut Shukla', 'Binoy Paul',
    );
    expect(txt).toBe('reassigned task from Marut Shukla to Binoy Paul');
  });

  it('assignee_change from unassigned → assigned', () => {
    const txt = formatActivityItem(
      'assignee_change', null, null, null, null, null, '(unassigned)', 'Binoy Paul',
    );
    expect(txt).toBe('assigned task to Binoy Paul');
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

/**
 * Pure helper that mirrors the change-detection branch of editTaskMutation.
 * Validates the rule set without depending on Supabase or React.
 */
function buildActivityRows(
  original: { title: string; description: string | null; owner_id: string | null },
  next: { title: string; description: string | null; owner_id: string | null },
  ownerNameOf: (id: string | null) => string | null,
) {
  const rows: Array<{
    update_type: 'title_change' | 'description_change' | 'assignee_change';
    previous_text: string;
    new_text: string;
  }> = [];
  if (original.title !== next.title) {
    rows.push({ update_type: 'title_change', previous_text: original.title, new_text: next.title });
  }
  const oldDesc = original.description ?? '(none)';
  const newDesc = next.description ?? '(none)';
  if (oldDesc !== newDesc) {
    rows.push({ update_type: 'description_change', previous_text: oldDesc, new_text: newDesc });
  }
  if (original.owner_id !== next.owner_id) {
    rows.push({
      update_type: 'assignee_change',
      previous_text: ownerNameOf(original.owner_id) ?? '(unassigned)',
      new_text: ownerNameOf(next.owner_id) ?? '(unassigned)',
    });
  }
  return rows;
}

describe('change detection (editTaskMutation rules)', () => {
  const names: Record<string, string> = { u1: 'Marut Shukla', u2: 'Binoy Paul' };
  const nameOf = (id: string | null) => (id ? names[id] ?? null : null);

  it('title unchanged → no title_change row', () => {
    const rows = buildActivityRows(
      { title: 'A', description: 'd', owner_id: 'u1' },
      { title: 'A', description: 'd', owner_id: 'u1' },
      nameOf,
    );
    expect(rows.find(r => r.update_type === 'title_change')).toBeUndefined();
  });

  it('title changed → one title_change row', () => {
    const rows = buildActivityRows(
      { title: 'A', description: 'd', owner_id: 'u1' },
      { title: 'B', description: 'd', owner_id: 'u1' },
      nameOf,
    );
    expect(rows.filter(r => r.update_type === 'title_change')).toHaveLength(1);
  });

  it('description unchanged → no description_change row', () => {
    const rows = buildActivityRows(
      { title: 'A', description: 'd', owner_id: 'u1' },
      { title: 'A', description: 'd', owner_id: 'u1' },
      nameOf,
    );
    expect(rows.find(r => r.update_type === 'description_change')).toBeUndefined();
  });

  it('owner_id changed → one assignee_change row', () => {
    const rows = buildActivityRows(
      { title: 'A', description: 'd', owner_id: 'u1' },
      { title: 'A', description: 'd', owner_id: 'u2' },
      nameOf,
    );
    const assigneeRows = rows.filter(r => r.update_type === 'assignee_change');
    expect(assigneeRows).toHaveLength(1);
    expect(assigneeRows[0].previous_text).toBe('Marut Shukla');
    expect(assigneeRows[0].new_text).toBe('Binoy Paul');
  });

  it('title AND owner both changed → two rows', () => {
    const rows = buildActivityRows(
      { title: 'A', description: 'd', owner_id: 'u1' },
      { title: 'B', description: 'd', owner_id: 'u2' },
      nameOf,
    );
    expect(rows).toHaveLength(2);
  });
});
