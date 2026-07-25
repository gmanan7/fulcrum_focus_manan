import { describe, it, expect } from 'vitest';
import { getDefaultRouteForRoles } from '@/lib/utils';

describe('getDefaultRouteForRoles', () => {
  it('routes shop_floor only users to kpi/entry', () => {
    expect(getDefaultRouteForRoles(['shop_floor'])).toBe('/kpi/entry');
  });

  it('routes super_admin to dashboard', () => {
    expect(getDefaultRouteForRoles(['super_admin'])).toBe('/dashboard');
  });

  it('routes team_member to dashboard', () => {
    expect(getDefaultRouteForRoles(['team_member'])).toBe('/dashboard');
  });

  it('routes department_head to dashboard', () => {
    expect(getDefaultRouteForRoles(['department_head'])).toBe('/dashboard');
  });

  it('routes factory_manager to dashboard', () => {
    expect(getDefaultRouteForRoles(['factory_manager'])).toBe('/dashboard');
  });

  it('does not route to kpi/entry if shop_floor has additional roles', () => {
    expect(getDefaultRouteForRoles(['shop_floor', 'team_member'])).toBe('/dashboard');
  });
});
