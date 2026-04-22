import { describe, it, expect } from 'vitest';
import type { PmMachine, PmPlan, PmActual } from '@/types/pm';
import {
  buildGridSummary,
  getOverdueBannerText,
  formatPmTooltip,
} from '@/lib/pmGridDisplay';

const mkM = (id: string): PmMachine => ({
  id,
  factory_id: 'f',
  line: 'SFM',
  group_name: 'G',
  name: id,
  is_critical: true,
  is_active: true,
  display_order: 1,
  created_at: 'x',
  updated_at: 'y',
});
const mkP = (machine_id: string, planned_date: string): PmPlan => ({
  id: `p-${machine_id}-${planned_date}`,
  machine_id,
  planned_date,
  created_by: null,
  created_at: 'x',
  updated_at: 'y',
});
const mkA = (machine_id: string, actual_date: string): PmActual => ({
  id: `a-${machine_id}-${actual_date}`,
  machine_id,
  actual_date,
  remarks: null,
  recorded_by: null,
  created_at: 'x',
  updated_at: 'y',
});

describe('buildGridSummary', () => {
  const today = '2026-04-22';
  const month = '2026-04';
  const machines = ['m1', 'm2', 'm3', 'm4', 'm5'].map(mkM);

  it('5 plans, 5 actuals on time → green', () => {
    const plans = machines.map((m) => mkP(m.id, '2026-04-10'));
    const actuals = machines.map((m) => mkA(m.id, '2026-04-10'));
    expect(buildGridSummary(machines, plans, actuals, month, today)).toEqual({
      done: 5, total: 5, overdue: 0, color: 'green',
    });
  });

  it('5 plans, 2 actuals → amber (no overdue)', () => {
    const plans = machines.map((m) => mkP(m.id, '2026-04-25')); // future
    const actuals = [mkA('m1', '2026-04-20'), mkA('m2', '2026-04-21')];
    expect(buildGridSummary(machines, plans, actuals, month, today)).toEqual({
      done: 2, total: 5, overdue: 0, color: 'amber',
    });
  });

  it('5 plans, 0 actuals, all overdue → red', () => {
    const plans = machines.map((m) => mkP(m.id, '2026-04-10'));
    expect(buildGridSummary(machines, plans, [], month, today)).toEqual({
      done: 0, total: 5, overdue: 5, color: 'red',
    });
  });

  it('0 plans → grey', () => {
    expect(buildGridSummary(machines, [], [], month, today)).toEqual({
      done: 0, total: 0, overdue: 0, color: 'grey',
    });
  });
});

describe('getOverdueBannerText', () => {
  it('returns null for 0', () => expect(getOverdueBannerText(0)).toBeNull());
  it('singular for 1', () => expect(getOverdueBannerText(1)).toBe('1 machine PM overdue'));
  it('plural for 3', () => expect(getOverdueBannerText(3)).toBe('3 machines PM overdue'));
});

describe('formatPmTooltip', () => {
  const today = '2026-04-22';

  it('done-on-time without remarks', () => {
    expect(formatPmTooltip('done-on-time', '2026-04-10', '2026-04-10', null, today))
      .toBe('Done: 10 Apr\nPlanned: 10 Apr');
  });

  it('done-delayed-minor with remarks', () => {
    expect(formatPmTooltip('done-delayed-minor', '2026-04-10', '2026-04-11', 'Oil changed', today))
      .toBe('Done: 11 Apr\nPlanned: 10 Apr\nDelayed by 1 day\nOil changed');
  });

  it('overdue', () => {
    expect(formatPmTooltip('overdue', '2026-04-08', null, null, today))
      .toBe('OVERDUE — Planned: 08 Apr, 14 days past due');
  });

  it('planned-future', () => {
    expect(formatPmTooltip('planned-future', '2026-04-30', null, null, today))
      .toBe('Planned: 30 Apr');
  });

  it('empty returns empty string', () => {
    expect(formatPmTooltip('empty', null, null, null, today)).toBe('');
  });
});
