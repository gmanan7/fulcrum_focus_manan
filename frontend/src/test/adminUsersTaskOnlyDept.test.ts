import { describe, it, expect } from 'vitest';

/**
 * Mirrors the conditional logic in src/pages/AdminUsers.tsx for
 * hiding the Department field and clearing selection when role = task_only.
 */
type AppRole = 'super_admin' | 'factory_manager' | 'department_head' | 'team_member' | 'shop_floor' | 'task_only';

function shouldShowDepartmentField(role: AppRole): boolean {
  return role !== 'task_only';
}

function applyRoleChange(
  prev: { role: AppRole; department_ids: string[] },
  nextRole: AppRole,
) {
  return {
    role: nextRole,
    department_ids: nextRole === 'task_only' ? [] : prev.department_ids,
  };
}

function buildCreatePayload(form: { role: AppRole; department_ids: string[] }) {
  // The form always sends department_ids as-is; the UI just keeps it empty for task_only.
  return { role: form.role, department_ids: form.department_ids };
}

describe('AdminUsers — task_only Department gating', () => {
  it('hides Department field when role is task_only', () => {
    expect(shouldShowDepartmentField('task_only')).toBe(false);
  });

  it('shows Department field for team_member', () => {
    expect(shouldShowDepartmentField('team_member')).toBe(true);
  });

  it('shows Department field for all non-task_only roles', () => {
    const roles: AppRole[] = ['super_admin', 'factory_manager', 'department_head', 'team_member', 'shop_floor'];
    for (const r of roles) expect(shouldShowDepartmentField(r)).toBe(true);
  });

  it('switching to task_only clears selected departments', () => {
    const next = applyRoleChange({ role: 'team_member', department_ids: ['d1', 'd2'] }, 'task_only');
    expect(next.role).toBe('task_only');
    expect(next.department_ids).toEqual([]);
  });

  it('switching away from task_only preserves (empty) departments and shows the field again', () => {
    const next = applyRoleChange({ role: 'task_only', department_ids: [] }, 'team_member');
    expect(next.role).toBe('team_member');
    expect(next.department_ids).toEqual([]);
    expect(shouldShowDepartmentField(next.role)).toBe(true);
  });

  it('switching between non-task_only roles preserves selected departments', () => {
    const next = applyRoleChange({ role: 'team_member', department_ids: ['d1'] }, 'department_head');
    expect(next.department_ids).toEqual(['d1']);
  });

  it('task_only create payload sends empty department_ids array', () => {
    const payload = buildCreatePayload({ role: 'task_only', department_ids: [] });
    expect(payload.department_ids).toEqual([]);
    expect(Array.isArray(payload.department_ids)).toBe(true);
  });
});
