import { describe, it, expect } from 'vitest';
import { canCreateMeeting, canManageMeeting } from '@/lib/meetingPermissions';

describe('canCreateMeeting', () => {
  it('true for super_admin', () => expect(canCreateMeeting(['super_admin'])).toBe(true));
  it('true for factory_manager', () => expect(canCreateMeeting(['factory_manager'])).toBe(true));
  it('true for department_head', () => expect(canCreateMeeting(['department_head'])).toBe(true));
  it('false for team_member', () => expect(canCreateMeeting(['team_member'])).toBe(false));
  it('false for shop_floor', () => expect(canCreateMeeting(['shop_floor'])).toBe(false));
  it('false for task_only', () => expect(canCreateMeeting(['task_only'])).toBe(false));
  it('false for empty roles', () => expect(canCreateMeeting([])).toBe(false));
});

describe('canManageMeeting', () => {
  it('super_admin can manage any meeting', () => {
    expect(canManageMeeting(['super_admin'], 'someone', 'me')).toBe(true);
  });
  it('factory_manager can manage any meeting', () => {
    expect(canManageMeeting(['factory_manager'], 'someone', 'me')).toBe(true);
  });
  it('HOD can manage meetings they created', () => {
    expect(canManageMeeting(['department_head'], 'me', 'me')).toBe(true);
  });
  it('HOD cannot manage meetings they did not create', () => {
    expect(canManageMeeting(['department_head'], 'someone', 'me')).toBe(false);
  });
  it('team_member cannot manage even meetings they created', () => {
    expect(canManageMeeting(['team_member'], 'me', 'me')).toBe(false);
  });
  it('returns false when userId is missing', () => {
    expect(canManageMeeting(['department_head'], 'me', null)).toBe(false);
  });
});
