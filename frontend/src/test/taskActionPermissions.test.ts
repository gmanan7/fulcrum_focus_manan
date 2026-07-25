import { describe, it, expect } from 'vitest';
import {
  canCloseTask,
  canChangeDueDate,
  canChangeStatus,
  canEditFields,
  type ActionContext,
  type ActionTask,
} from '@/lib/taskActionPermissions';

const task: ActionTask = {
  owner_id: 'OWNER',
  assigned_by: 'CREATOR',
  department_id: 'D1',
  task_group_id: 'G1',
};

const ctx = (over: Partial<ActionContext>): ActionContext => ({
  userId: 'X',
  roles: ['team_member'],
  userDepartmentIds: [],
  leaderGroupIds: [],
  ...over,
});

describe('canCloseTask', () => {
  it('false for plain owner (no other role)', () => {
    expect(canCloseTask(task, ctx({ userId: 'OWNER' }))).toBe(false);
  });
  it('true for creator', () => {
    expect(canCloseTask(task, ctx({ userId: 'CREATOR' }))).toBe(true);
  });
  it('true for super_admin', () => {
    expect(canCloseTask(task, ctx({ userId: 'Z', roles: ['super_admin'] }))).toBe(true);
  });
  it('true for factory_manager', () => {
    expect(canCloseTask(task, ctx({ userId: 'Z', roles: ['factory_manager'] }))).toBe(true);
  });
  it('true for group leader of task group', () => {
    expect(canCloseTask(task, ctx({ userId: 'Z', leaderGroupIds: ['G1'] }))).toBe(true);
  });
  it('false for HOD of same dept (not allowed to close)', () => {
    expect(canCloseTask(task, ctx({ userId: 'Z', roles: ['department_head'], userDepartmentIds: ['D1'] }))).toBe(false);
  });
  it('false for same-dept member', () => {
    expect(canCloseTask(task, ctx({ userId: 'Z', userDepartmentIds: ['D1'] }))).toBe(false);
  });
});

describe('canChangeDueDate', () => {
  it('false for plain owner', () => {
    expect(canChangeDueDate(task, ctx({ userId: 'OWNER' }))).toBe(false);
  });
  it('true for creator', () => {
    expect(canChangeDueDate(task, ctx({ userId: 'CREATOR' }))).toBe(true);
  });
  it('false for HOD of dept', () => {
    expect(canChangeDueDate(task, ctx({ userId: 'Z', roles: ['department_head'], userDepartmentIds: ['D1'] }))).toBe(false);
  });
  it('true for group leader', () => {
    expect(canChangeDueDate(task, ctx({ userId: 'Z', leaderGroupIds: ['G1'] }))).toBe(true);
  });
});

describe('canChangeStatus', () => {
  it('true for owner (non-closing)', () => {
    expect(canChangeStatus(task, ctx({ userId: 'OWNER' }))).toBe(true);
  });
  it('true for creator', () => {
    expect(canChangeStatus(task, ctx({ userId: 'CREATOR' }))).toBe(true);
  });
  it('true for same-dept member', () => {
    expect(canChangeStatus(task, ctx({ userId: 'Z', userDepartmentIds: ['D1'] }))).toBe(true);
  });
  it('true for HOD of dept', () => {
    expect(canChangeStatus(task, ctx({ userId: 'Z', roles: ['department_head'], userDepartmentIds: ['D1'] }))).toBe(true);
  });
  it('true for group leader', () => {
    expect(canChangeStatus(task, ctx({ userId: 'Z', leaderGroupIds: ['G1'] }))).toBe(true);
  });
  it('true for admin', () => {
    expect(canChangeStatus(task, ctx({ userId: 'Z', roles: ['super_admin'] }))).toBe(true);
  });
  it('false for unrelated user', () => {
    expect(canChangeStatus(task, ctx({ userId: 'Z' }))).toBe(false);
  });
});

describe('canEditFields', () => {
  it('false for owner only', () => {
    expect(canEditFields(task, ctx({ userId: 'OWNER' }))).toBe(false);
  });
  it('true for creator', () => {
    expect(canEditFields(task, ctx({ userId: 'CREATOR' }))).toBe(true);
  });
  it('true for HOD of dept', () => {
    expect(canEditFields(task, ctx({ userId: 'Z', roles: ['department_head'], userDepartmentIds: ['D1'] }))).toBe(true);
  });
  it('false for HOD of OTHER dept', () => {
    expect(canEditFields(task, ctx({ userId: 'Z', roles: ['department_head'], userDepartmentIds: ['D2'] }))).toBe(false);
  });
  it('true for group leader', () => {
    expect(canEditFields(task, ctx({ userId: 'Z', leaderGroupIds: ['G1'] }))).toBe(true);
  });
});
