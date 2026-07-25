import { describe, it, expect } from 'vitest';
import { canRevertActual, getCellState } from '@/lib/pmSchedule';
import type { PmPlan } from '@/types/pm';

describe('canRevertActual', () => {
  it('allows super_admin', () => expect(canRevertActual('super_admin')).toBe(true));
  it('allows factory_manager', () => expect(canRevertActual('factory_manager')).toBe(true));
  it('allows department_head', () => expect(canRevertActual('department_head')).toBe(true));
  it('allows team_member in ENG dept', () =>
    expect(canRevertActual('team_member', ['ENG'])).toBe(true));
  it('denies team_member outside ENG', () =>
    expect(canRevertActual('team_member', ['SFM'])).toBe(false));
  it('denies shop_floor', () => expect(canRevertActual('shop_floor', ['ENG'])).toBe(false));
});

describe('getCellState after actual deletion', () => {
  it('reverts to planned-past when actual is removed (today/recent)', () => {
    const plan: PmPlan = {
      id: 'p1',
      machine_id: 'm1',
      planned_date: '2026-04-22',
      created_by: null,
      created_at: '',
      updated_at: '',
    };
    const state = getCellState(plan, null, '2026-04-22', '2026-04-22');
    expect(state).toBe('planned-past');
    expect(state).not.toBe('done-on-time');
  });

  it('reverts to planned-future when actual removed for future plan', () => {
    const plan: PmPlan = {
      id: 'p2',
      machine_id: 'm1',
      planned_date: '2026-05-10',
      created_by: null,
      created_at: '',
      updated_at: '',
    };
    const state = getCellState(plan, null, '2026-05-10', '2026-04-22');
    expect(state).toBe('planned-future');
    expect(state).not.toBe('done-on-time');
  });
});
