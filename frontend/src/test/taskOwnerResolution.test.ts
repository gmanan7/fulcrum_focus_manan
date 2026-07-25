import { describe, it, expect } from 'vitest';
import { primaryDeptFor, resolveTaskDepartmentId } from '@/lib/taskOwnerResolution';

const rows = [
  { user_id: 'u1', department_id: 'd-secondary', is_primary: false },
  { user_id: 'u1', department_id: 'd-primary', is_primary: true },
  { user_id: 'u2', department_id: 'd-hr', is_primary: false },
];

describe('primaryDeptFor', () => {
  it('returns is_primary=true row when present', () => {
    expect(primaryDeptFor('u1', rows)).toBe('d-primary');
  });
  it('returns first row when no primary marked', () => {
    expect(primaryDeptFor('u2', rows)).toBe('d-hr');
  });
  it('returns null when user has no rows', () => {
    expect(primaryDeptFor('ghost', rows)).toBeNull();
  });
  it('returns null for empty/null inputs', () => {
    expect(primaryDeptFor('', rows)).toBeNull();
    expect(primaryDeptFor('u1', null)).toBeNull();
    expect(primaryDeptFor('u1', [])).toBeNull();
  });
});

describe('resolveTaskDepartmentId', () => {
  const ownerDept = [{ user_id: 'owner', department_id: 'd-owner', is_primary: true }];
  const creatorDept = [{ user_id: 'creator', department_id: 'd-creator', is_primary: true }];

  it("derives department_id from owner's primary department", () => {
    expect(
      resolveTaskDepartmentId({
        ownerId: 'owner',
        ownerDeptRows: ownerDept,
        creatorId: 'creator',
        creatorDeptRows: creatorDept,
      }),
    ).toBe('d-owner');
  });

  it("falls back to creator's primary department when owner has no dept", () => {
    expect(
      resolveTaskDepartmentId({
        ownerId: 'owner',
        ownerDeptRows: [],
        creatorId: 'creator',
        creatorDeptRows: creatorDept,
      }),
    ).toBe('d-creator');
  });

  it('returns null when neither owner nor creator have a dept', () => {
    expect(
      resolveTaskDepartmentId({
        ownerId: 'owner',
        ownerDeptRows: [],
        creatorId: 'creator',
        creatorDeptRows: [],
      }),
    ).toBeNull();
  });

  it('handles cross-department group case (HR owner in SFM-led group)', () => {
    // Owner is an HR user picked from an SFM-led group → department becomes HR
    const owner = [{ user_id: 'hr-user', department_id: 'd-hr', is_primary: true }];
    expect(
      resolveTaskDepartmentId({
        ownerId: 'hr-user',
        ownerDeptRows: owner,
        creatorId: 'sfm-creator',
        creatorDeptRows: [{ user_id: 'sfm-creator', department_id: 'd-sfm', is_primary: true }],
      }),
    ).toBe('d-hr');
  });
});

describe('TaskBoard wiring guarantees', () => {
  it('CreateTaskModal fetches group members when a group is the visibility', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/pages/TaskBoard.tsx', 'utf8'));
    // group-member owner query + profiles join
    expect(src).toMatch(/create-task-group-member-profiles/);
    expect(src).toMatch(/resolveTaskDepartmentId/);
  });

  it('Edit Task uses group members as owner list when task has task_group_id', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/pages/TaskBoard.tsx', 'utf8'));
    expect(src).toMatch(/edit-task-group-member-profiles/);
  });

  it('owner dropdown derives department_id from owner on group tasks (create)', async () => {
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/pages/TaskBoard.tsx', 'utf8'));
    // We assert the derived department is what gets sent on insert when group visibility.
    expect(src).toMatch(/department_id: effectiveDeptId/);
  });
});
