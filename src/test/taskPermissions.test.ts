import { describe, it, expect } from 'vitest';
import { canUpdateTask, canUpdateTaskAnyRole } from '@/lib/taskPermissions';

const baseTask = { owner_id: 'A', assigned_by: 'B' };

describe('canUpdateTask', () => {
  it('super_admin → true regardless of ownership', () => {
    expect(canUpdateTask(baseTask, 'Z', 'super_admin')).toBe(true);
  });

  it('factory_manager → true regardless of ownership', () => {
    expect(canUpdateTask(baseTask, 'Z', 'factory_manager')).toBe(true);
  });

  it('team_member who is owner → true', () => {
    expect(canUpdateTask({ owner_id: 'A' }, 'A', 'team_member')).toBe(true);
  });

  it('team_member who is NOT owner → false', () => {
    expect(canUpdateTask({ owner_id: 'A' }, 'B', 'team_member')).toBe(false);
  });

  it('shop_floor who is owner → true', () => {
    expect(canUpdateTask({ owner_id: 'X' }, 'X', 'shop_floor')).toBe(true);
  });

  it('shop_floor who is NOT owner → false', () => {
    expect(canUpdateTask({ owner_id: 'X' }, 'Y', 'shop_floor')).toBe(false);
  });

  it('department_head who is the assigner → true', () => {
    expect(canUpdateTask({ owner_id: 'A', assigned_by: 'B' }, 'B', 'department_head')).toBe(true);
  });

  it('department_head who is the owner → true', () => {
    expect(canUpdateTask({ owner_id: 'A', assigned_by: 'B' }, 'A', 'department_head')).toBe(true);
  });

  it('department_head who is neither owner nor assigner → false', () => {
    expect(canUpdateTask({ owner_id: 'A', assigned_by: 'B' }, 'C', 'department_head')).toBe(false);
  });

  it('unknown role falls back to owner-only check', () => {
    expect(canUpdateTask({ owner_id: 'A' }, 'A', 'foobar')).toBe(true);
    expect(canUpdateTask({ owner_id: 'A' }, 'B', 'foobar')).toBe(false);
  });
});

describe('canUpdateTaskAnyRole', () => {
  it('returns true if any role grants access', () => {
    expect(
      canUpdateTaskAnyRole({ owner_id: 'A', assigned_by: 'B' }, 'C', [
        'team_member',
        'super_admin',
      ]),
    ).toBe(true);
  });

  it('returns false if no role grants access', () => {
    expect(
      canUpdateTaskAnyRole({ owner_id: 'A', assigned_by: 'B' }, 'C', [
        'team_member',
        'shop_floor',
      ]),
    ).toBe(false);
  });
});
