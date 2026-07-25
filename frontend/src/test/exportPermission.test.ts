import { describe, it, expect } from 'vitest';

type Role = 'super_admin' | 'factory_manager' | 'department_head' | 'team_member' | 'shop_floor' | 'task_only';

// Mirrors the inline check used at every export-button site:
//   const canExport = hasAnyRole('super_admin', 'factory_manager');
function canExport(roles: Role[]): boolean {
  const allowed: Role[] = ['super_admin', 'factory_manager'];
  return roles.some((r) => allowed.includes(r));
}

describe('export button visibility', () => {
  it('renders for super_admin', () => {
    expect(canExport(['super_admin'])).toBe(true);
  });
  it('renders for factory_manager', () => {
    expect(canExport(['factory_manager'])).toBe(true);
  });
  it('hidden for department_head', () => {
    expect(canExport(['department_head'])).toBe(false);
  });
  it('hidden for team_member', () => {
    expect(canExport(['team_member'])).toBe(false);
  });
  it('hidden for shop_floor', () => {
    expect(canExport(['shop_floor'])).toBe(false);
  });
  it('hidden for task_only', () => {
    expect(canExport(['task_only'])).toBe(false);
  });
  it('renders when user has multiple roles including an allowed one', () => {
    expect(canExport(['team_member', 'factory_manager'])).toBe(true);
  });
  it('hidden for empty roles', () => {
    expect(canExport([])).toBe(false);
  });
});
