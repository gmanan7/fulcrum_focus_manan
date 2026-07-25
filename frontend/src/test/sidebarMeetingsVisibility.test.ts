import { describe, it, expect } from 'vitest';

// Mirrors the Meetings nav item config in AppSidebar.tsx and MobileBottomNav.tsx
const meetingsItem = { roles: null as string[] | null, hideForShopFloor: false };

function canSeeMeetings(roles: string[]): boolean {
  const isShopFloorOnly = roles.length === 1 && roles[0] === 'shop_floor';
  const isTaskOnly = roles.length === 1 && roles[0] === 'task_only';
  if (isTaskOnly) return false; // task_only restricted to /tasks and /planner
  if (isShopFloorOnly && meetingsItem.hideForShopFloor) return false;
  if (!meetingsItem.roles) return true;
  return meetingsItem.roles.some((r) => roles.includes(r));
}

describe('Sidebar Meetings link visibility', () => {
  it('visible for department_head', () => expect(canSeeMeetings(['department_head'])).toBe(true));
  it('visible for super_admin', () => expect(canSeeMeetings(['super_admin'])).toBe(true));
  it('visible for factory_manager', () => expect(canSeeMeetings(['factory_manager'])).toBe(true));
  it('visible for team_member', () => expect(canSeeMeetings(['team_member'])).toBe(true));
  it('visible for shop_floor', () => expect(canSeeMeetings(['shop_floor'])).toBe(true));
  it('NOT visible for task_only', () => expect(canSeeMeetings(['task_only'])).toBe(false));
});
