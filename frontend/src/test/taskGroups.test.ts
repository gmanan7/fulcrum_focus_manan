import { describe, it, expect } from 'vitest';
import {
  canSeeGroupTask,
  canCreateGroup,
  canDeleteGroup,
  canManageGroup,
  canManageGroupMembers,
  canPickGroupForTask,
  taskVisibility,
  truncateGroupName,
  shouldWarnOwnerNotInGroup,
} from '@/lib/taskGroups';

const groupTask = { task_group_id: 'g1' };
const nonGroupTask = { task_group_id: null };
const group = { id: 'g1', created_by: 'creator-1' };

describe('canSeeGroupTask', () => {
  it('member can see group task → true', () => {
    expect(canSeeGroupTask(groupTask, 'u1', ['team_member'], new Set(['g1']))).toBe(true);
  });
  it('non-member cannot see group task → false', () => {
    expect(canSeeGroupTask(groupTask, 'u2', ['team_member'], new Set(['g2']))).toBe(false);
  });
  it('super_admin can see any group task → true', () => {
    expect(canSeeGroupTask(groupTask, 'admin', ['super_admin'], new Set())).toBe(true);
  });
  it('factory_manager can see any group task → true', () => {
    expect(canSeeGroupTask(groupTask, 'fm', ['factory_manager'], new Set())).toBe(true);
  });
  it('non-group task is visible regardless of membership → true', () => {
    expect(canSeeGroupTask(nonGroupTask, 'u', [], new Set())).toBe(true);
  });
  it('unauthenticated viewer cannot see → false', () => {
    expect(canSeeGroupTask(groupTask, null, [], new Set(['g1']))).toBe(false);
  });
});

describe('canCreateGroup', () => {
  it('super_admin can create → true', () => {
    expect(canCreateGroup('u', ['super_admin'])).toBe(true);
  });
  it('factory_manager can create → true', () => {
    expect(canCreateGroup('u', ['factory_manager'])).toBe(true);
  });
  it('department_head can create → true', () => {
    expect(canCreateGroup('u', ['department_head'])).toBe(true);
  });
  it('team_member cannot create → false', () => {
    expect(canCreateGroup('u', ['team_member'])).toBe(false);
  });
  it('shop_floor cannot create → false', () => {
    expect(canCreateGroup('u', ['shop_floor'])).toBe(false);
  });
  it('task_only cannot create → false', () => {
    expect(canCreateGroup('u', ['task_only'])).toBe(false);
  });
  it('unauthenticated cannot create → false', () => {
    expect(canCreateGroup(null, ['super_admin'])).toBe(false);
  });
});

describe('canDeleteGroup', () => {
  it('super_admin can delete → true', () => {
    expect(canDeleteGroup('u', ['super_admin'])).toBe(true);
  });
  it('factory_manager can delete → true', () => {
    expect(canDeleteGroup('u', ['factory_manager'])).toBe(true);
  });
  it('department_head cannot delete → false', () => {
    expect(canDeleteGroup('u', ['department_head'])).toBe(false);
  });
  it('team_member cannot delete → false', () => {
    expect(canDeleteGroup('u', ['team_member'])).toBe(false);
  });
});

describe('canManageGroupMembers', () => {
  it('super_admin can manage any group → true', () => {
    expect(canManageGroupMembers(group, 'admin', ['super_admin'])).toBe(true);
  });
  it('factory_manager can manage any group → true', () => {
    expect(canManageGroupMembers(group, 'fm', ['factory_manager'])).toBe(true);
  });
  it('department_head who created the group can manage → true', () => {
    expect(canManageGroupMembers(group, 'creator-1', ['department_head'])).toBe(true);
  });
  it("department_head who didn't create cannot manage → false", () => {
    expect(canManageGroupMembers(group, 'other-hod', ['department_head'])).toBe(false);
  });
  it('team_member cannot manage even if creator → false', () => {
    expect(canManageGroupMembers(group, 'creator-1', ['team_member'])).toBe(false);
  });
});

describe('canManageGroup (rename) mirrors canManageGroupMembers', () => {
  it('department_head creator can manage → true', () => {
    expect(canManageGroup(group, 'creator-1', ['department_head'])).toBe(true);
  });
  it('non-admin non-creator cannot manage → false', () => {
    expect(canManageGroup(group, 'someone', ['team_member'])).toBe(false);
  });
});

describe('canPickGroupForTask', () => {
  it('super_admin sees all groups → true', () => {
    expect(canPickGroupForTask(group, 'admin', ['super_admin'], new Set())).toBe(true);
  });
  it('factory_manager sees all groups → true', () => {
    expect(canPickGroupForTask(group, 'fm', ['factory_manager'], new Set())).toBe(true);
  });
  it('member sees their own group → true', () => {
    expect(canPickGroupForTask(group, 'u', ['team_member'], new Set(['g1']))).toBe(true);
  });
  it('non-member non-admin → false', () => {
    expect(canPickGroupForTask(group, 'u', ['team_member'], new Set())).toBe(false);
  });
  it('shop_floor never sees groups even if member → false', () => {
    expect(canPickGroupForTask(group, 'u', ['shop_floor'], new Set(['g1']))).toBe(false);
  });
  it('task_only never sees groups even if member → false', () => {
    expect(canPickGroupForTask(group, 'u', ['task_only'], new Set(['g1']))).toBe(false);
  });
});

describe('taskVisibility', () => {
  it("'everyone' → is_private=false, task_group_id=null", () => {
    expect(taskVisibility('everyone')).toEqual({ is_private: false, task_group_id: null });
  });
  it("'private' → is_private=true, task_group_id=null", () => {
    expect(taskVisibility('private')).toEqual({ is_private: true, task_group_id: null });
  });
  it('groupId → task_group_id=groupId, is_private=false', () => {
    expect(taskVisibility('group-xyz')).toEqual({ is_private: false, task_group_id: 'group-xyz' });
  });
});

describe('truncateGroupName', () => {
  it('short name unchanged', () => {
    expect(truncateGroupName('Alpha')).toBe('Alpha');
  });
  it('long name truncated with ellipsis at 12 chars', () => {
    const out = truncateGroupName('Production Engineering Team');
    expect(out.length).toBeLessThanOrEqual(12);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('shouldWarnOwnerNotInGroup', () => {
  const members = new Set(['member-1', 'member-2']);

  it('warns when owner is not in selected group', () => {
    expect(shouldWarnOwnerNotInGroup('group-1', 'outsider', members)).toBe(true);
  });
  it('does not warn when owner IS a group member', () => {
    expect(shouldWarnOwnerNotInGroup('group-1', 'member-1', members)).toBe(false);
  });
  it('does not warn when visibility is everyone', () => {
    expect(shouldWarnOwnerNotInGroup('everyone', 'outsider', members)).toBe(false);
  });
  it('does not warn when visibility is private', () => {
    expect(shouldWarnOwnerNotInGroup('private', 'outsider', members)).toBe(false);
  });
  it('does not warn when no owner selected yet', () => {
    expect(shouldWarnOwnerNotInGroup('group-1', '', members)).toBe(false);
    expect(shouldWarnOwnerNotInGroup('group-1', null, members)).toBe(false);
  });
  it('does not warn while members are still loading (null set)', () => {
    expect(shouldWarnOwnerNotInGroup('group-1', 'outsider', null)).toBe(false);
  });
  it('clears once owner changes to a group member', () => {
    expect(shouldWarnOwnerNotInGroup('group-1', 'outsider', members)).toBe(true);
    expect(shouldWarnOwnerNotInGroup('group-1', 'member-2', members)).toBe(false);
  });
});

describe('GroupsPanel UX copy', () => {
  // Source-level guarantees so dialog wording can't silently regress.
  it('CreateGroupForm no longer auto-adds creator (insert uses only `selected`)', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/tasks/GroupsPanel.tsx', 'utf8'),
    );
    expect(src).toMatch(/Do NOT auto-add the creator/);
    // Old auto-add pattern must not be present:
    expect(src).not.toMatch(/new Set\(\[user!\.id, \.\.\.Array\.from\(selected\)\]\)/);
  });

  it('Delete-group dialog mentions tasks becoming private', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/tasks/GroupsPanel.tsx', 'utf8'),
    );
    expect(src).toMatch(/Active tasks in this group will become private/);
    expect(src).toMatch(/Delete Group/);
  });

  it('Remove-member dialog mentions tasks becoming private', async () => {
    const src = await import('node:fs').then((fs) =>
      fs.readFileSync('src/components/tasks/GroupsPanel.tsx', 'utf8'),
    );
    expect(src).toMatch(/Their active tasks in this group will become private/);
    expect(src).toMatch(/Remove Member/);
  });
});
