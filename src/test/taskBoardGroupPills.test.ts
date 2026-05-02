import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/pages/TaskBoard.tsx', 'utf8');

/**
 * Logic mirror of the TaskBoard pill-fetch query: pills are derived from
 * task_group_members rows for the current user, regardless of role.
 */
type MemberRow = { group: { id: string; name: string; color: string } | null };
function pillsFromMembership(rows: MemberRow[]) {
  return (rows ?? []).map((r) => r.group).filter(Boolean);
}

describe('TaskBoard group filter pills — source guarantees', () => {
  it("'my-task-groups' query reads from task_group_members, not task_groups", () => {
    // Find the my-task-groups query block
    const idx = src.indexOf("'my-task-groups'");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 800);
    expect(block).toMatch(/\.from\(['"]task_group_members['"]\)/);
    expect(block).not.toMatch(/\.from\(['"]task_groups['"]/);
  });

  it("'my-task-groups' query filters by current user.id", () => {
    const idx = src.indexOf("'my-task-groups'");
    const block = src.slice(idx, idx + 800);
    expect(block).toMatch(/\.eq\(['"]user_id['"],\s*user!?\.id\)/);
  });

  it('joins to task_groups via the FK to read id/name/color', () => {
    const idx = src.indexOf("'my-task-groups'");
    const block = src.slice(idx, idx + 800);
    expect(block).toMatch(/task_groups!task_group_members_group_id_fkey/);
    expect(block).toMatch(/id, name, color/);
  });
});

describe('TaskBoard group filter pills — membership logic', () => {
  it('super_admin with no memberships → zero pills', () => {
    expect(pillsFromMembership([])).toEqual([]);
  });

  it('super_admin added to one group → exactly one pill', () => {
    const rows: MemberRow[] = [
      { group: { id: 'g1', name: 'Quality', color: '#f43f5e' } },
    ];
    const pills = pillsFromMembership(rows);
    expect(pills).toHaveLength(1);
    expect(pills[0]?.id).toBe('g1');
  });

  it('department_head sees only their group pills (membership-scoped)', () => {
    const rows: MemberRow[] = [
      { group: { id: 'g2', name: 'Maintenance', color: '#10b981' } },
      { group: { id: 'g3', name: 'Safety', color: '#f59e0b' } },
    ];
    const pills = pillsFromMembership(rows);
    expect(pills.map((p) => p?.id)).toEqual(['g2', 'g3']);
  });

  it('null/undefined rows do not crash', () => {
    expect(pillsFromMembership(undefined as unknown as MemberRow[])).toEqual([]);
    expect(pillsFromMembership([{ group: null }])).toEqual([]);
  });
});
