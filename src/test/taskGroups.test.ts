import { describe, it, expect } from 'vitest';
import {
  canSeeGroupTask,
  canCreateGroup,
  canManageGroup,
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
  it('any authenticated user can create → true', () => {
    expect(canCreateGroup('anyone')).toBe(true);
  });
  it('unauthenticated cannot create → false', () => {
    expect(canCreateGroup(null)).toBe(false);
  });
});

describe('canManageGroup', () => {
  it('creator can manage → true', () => {
    expect(canManageGroup(group, 'creator-1', ['team_member'])).toBe(true);
  });
  it('non-creator member cannot manage → false', () => {
    expect(canManageGroup(group, 'member-2', ['team_member'])).toBe(false);
  });
  it('super_admin can manage → true', () => {
    expect(canManageGroup(group, 'admin', ['super_admin'])).toBe(true);
  });
  it('factory_manager (non-creator) cannot manage → false', () => {
    expect(canManageGroup(group, 'fm', ['factory_manager'])).toBe(false);
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
