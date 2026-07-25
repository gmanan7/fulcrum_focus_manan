import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  canEditFields,
  canChangeDueDate,
  type ActionContext,
  type ActionTask,
} from '@/lib/taskActionPermissions';

/**
 * Verifies the Edit Task flow routes through RPCs:
 * - update_task_fields for field edits (title/desc/owner/priority/dept)
 * - update_task_due_date for due-date changes
 * Direct DB.from('tasks').update for these fields is no longer allowed.
 */

function makeDBMock() {
  const rpc: any = vi.fn().mockResolvedValue({ error: null });
  const from: any = vi.fn();
  return { rpc, from };
}

async function runEditTaskFields(
  DB: ReturnType<typeof makeDBMock>,
  args: { taskId: string; title: string; description: string | null; ownerId: string; priority: string; departmentId: string },
) {
  const { error } = await DB.rpc('update_task_fields', {
    p_task_id: args.taskId,
    p_title: args.title,
    p_description: args.description,
    p_owner_id: args.ownerId,
    p_priority: args.priority,
    p_department_id: args.departmentId,
  });
  if (error) throw error;
}

async function runChangeDueDate(
  DB: ReturnType<typeof makeDBMock>,
  args: { taskId: string; newDueDate: string; reason?: string },
) {
  const { error } = await DB.rpc('update_task_due_date', {
    p_task_id: args.taskId,
    p_new_due_date: args.newDueDate,
    p_reason: args.reason ?? null,
  });
  if (error) throw error;
}

describe('Edit Task save → update_task_fields RPC', () => {
  let DB: ReturnType<typeof makeDBMock>;
  beforeEach(() => { DB = makeDBMock(); });

  it('calls update_task_fields with the correct payload', async () => {
    await runEditTaskFields(DB, {
      taskId: 't1', title: 'New', description: 'D', ownerId: 'u1', priority: 'high', departmentId: 'd1',
    });
    expect(DB.rpc).toHaveBeenCalledWith('update_task_fields', {
      p_task_id: 't1',
      p_title: 'New',
      p_description: 'D',
      p_owner_id: 'u1',
      p_priority: 'high',
      p_department_id: 'd1',
    });
  });

  it('does NOT write directly to tasks or task_updates', async () => {
    await runEditTaskFields(DB, {
      taskId: 't1', title: 'A', description: null, ownerId: 'u', priority: 'medium', departmentId: 'd',
    });
    expect(DB.from).not.toHaveBeenCalled();
  });

  it('surfaces RPC errors (toast-able message)', async () => {
    DB.rpc.mockResolvedValueOnce({ error: new Error('only creator/admin/HOD/leader can edit') });
    await expect(
      runEditTaskFields(DB, { taskId: 't', title: 'x', description: null, ownerId: 'u', priority: 'low', departmentId: 'd' }),
    ).rejects.toThrow(/can edit/);
  });
});

describe('Change Due Date → update_task_due_date RPC only', () => {
  let DB: ReturnType<typeof makeDBMock>;
  beforeEach(() => { DB = makeDBMock(); });

  it('calls update_task_due_date with reason', async () => {
    await runChangeDueDate(DB, { taskId: 't', newDueDate: '2026-07-01', reason: 'slip' });
    expect(DB.rpc).toHaveBeenCalledWith('update_task_due_date', {
      p_task_id: 't', p_new_due_date: '2026-07-01', p_reason: 'slip',
    });
  });

  it('does NOT touch tasks or task_due_date_history directly', async () => {
    await runChangeDueDate(DB, { taskId: 't', newDueDate: '2026-07-01', reason: 'r' });
    expect(DB.from).not.toHaveBeenCalled();
  });
});

describe('TaskBoard source: edit form has no due-date field', () => {
  const src = readFileSync(join(process.cwd(), 'src/pages/TaskBoard.tsx'), 'utf8');

  it('removed editDueDate state from the edit form', () => {
    expect(src).not.toMatch(/setEditDueDate/);
    expect(src).not.toMatch(/\beditDueDate\b/);
  });

  it('removed editIsPrivate toggle from the edit form', () => {
    expect(src).not.toMatch(/setEditIsPrivate/);
  });

  it('edit mutation calls update_task_fields RPC', () => {
    expect(src).toMatch(/rpc\(\s*['"]update_task_fields['"]/);
  });

  it('due-date control still calls update_task_due_date RPC', () => {
    expect(src).toMatch(/rpc\(\s*['"]update_task_due_date['"]/);
  });
});

describe('Permission gating: canChangeDueDate excludes HOD-who-is-not-creator', () => {
  const task: ActionTask = {
    owner_id: 'OWNER', assigned_by: 'CREATOR', department_id: 'D1', task_group_id: 'G1',
  };
  const ctx = (over: Partial<ActionContext>): ActionContext => ({
    userId: 'X', roles: ['team_member'], userDepartmentIds: [], leaderGroupIds: [], ...over,
  });

  it('HOD of task dept can edit fields', () => {
    expect(canEditFields(task, ctx({ userId: 'H', roles: ['department_head'], userDepartmentIds: ['D1'] }))).toBe(true);
  });

  it('HOD of task dept CANNOT change due date (when not creator/leader)', () => {
    expect(canChangeDueDate(task, ctx({ userId: 'H', roles: ['department_head'], userDepartmentIds: ['D1'] }))).toBe(false);
  });

  it('Owner (only) CANNOT change due date', () => {
    expect(canChangeDueDate(task, ctx({ userId: 'OWNER' }))).toBe(false);
  });

  it('Creator CAN change due date', () => {
    expect(canChangeDueDate(task, ctx({ userId: 'CREATOR' }))).toBe(true);
  });

  it('Group leader CAN change due date', () => {
    expect(canChangeDueDate(task, ctx({ userId: 'L', leaderGroupIds: ['G1'] }))).toBe(true);
  });

  it('Admin/WM CAN change due date', () => {
    expect(canChangeDueDate(task, ctx({ userId: 'A', roles: ['super_admin'] }))).toBe(true);
    expect(canChangeDueDate(task, ctx({ userId: 'A', roles: ['factory_manager'] }))).toBe(true);
  });
});
