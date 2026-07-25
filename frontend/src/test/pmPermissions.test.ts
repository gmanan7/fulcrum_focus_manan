import { describe, it, expect } from 'vitest';
import {
  canTogglePlan,
  canMarkActual,
  canMarkActualWithoutPlan,
} from '@/lib/pmSchedule';

describe('canTogglePlan', () => {
  it('super_admin allowed', () => expect(canTogglePlan('super_admin', [])).toBe(true));
  it('factory_manager allowed', () => expect(canTogglePlan('factory_manager', [])).toBe(true));
  it('department_head allowed', () => expect(canTogglePlan('department_head', [])).toBe(true));
  it('team_member (ENG) read-only in plan mode', () =>
    expect(canTogglePlan('team_member', ['ENG'])).toBe(false));
  it('shop_floor not allowed', () =>
    expect(canTogglePlan('shop_floor', ['ENG'])).toBe(false));
});

describe('canMarkActual', () => {
  it('super_admin allowed', () => expect(canMarkActual('super_admin', [])).toBe(true));
  it('factory_manager allowed', () => expect(canMarkActual('factory_manager', [])).toBe(true));
  it('department_head allowed', () => expect(canMarkActual('department_head', [])).toBe(true));
  it('team_member ENG allowed', () =>
    expect(canMarkActual('team_member', ['ENG'])).toBe(true));
  it('team_member non-ENG denied', () =>
    expect(canMarkActual('team_member', ['SFM'])).toBe(false));
  it('shop_floor denied', () =>
    expect(canMarkActual('shop_floor', ['ENG'])).toBe(false));
});

describe('canMarkActualWithoutPlan', () => {
  it('department_head allowed', () =>
    expect(canMarkActualWithoutPlan('department_head', [])).toBe(true));
  it('team_member ENG allowed', () =>
    expect(canMarkActualWithoutPlan('team_member', ['ENG'])).toBe(true));
  it('team_member non-ENG denied', () =>
    expect(canMarkActualWithoutPlan('team_member', ['SFM'])).toBe(false));
  it('shop_floor denied', () =>
    expect(canMarkActualWithoutPlan('shop_floor', ['ENG'])).toBe(false));
});
