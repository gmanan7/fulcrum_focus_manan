import { describe, it, expect } from 'vitest';
import type { PmMachine, PmPlan, PmActual } from '@/types/pm';
import {
  getCellState,
  getOverdueMachines,
  filterMachinesByLine,
  groupMachinesByGroup,
  daysOfMonth,
} from '@/lib/pmSchedule';

const mkMachine = (over: Partial<PmMachine> = {}): PmMachine => ({
  id: over.id ?? 'm1',
  factory_id: 'f1',
  line: over.line ?? 'SFM',
  group_name: over.group_name ?? 'Printing',
  name: over.name ?? 'Heidelberg - 1',
  is_critical: over.is_critical ?? true,
  is_active: true,
  display_order: over.display_order ?? 1,
  created_at: 'x',
  updated_at: 'y',
});

const mkPlan = (machine_id: string, planned_date: string): PmPlan => ({
  id: `p-${machine_id}-${planned_date}`,
  machine_id,
  planned_date,
  created_by: null,
  created_at: 'x',
  updated_at: 'y',
});

const mkActual = (machine_id: string, actual_date: string): PmActual => ({
  id: `a-${machine_id}-${actual_date}`,
  machine_id,
  actual_date,
  remarks: null,
  recorded_by: null,
  created_at: 'x',
  updated_at: 'y',
});

describe('getCellState', () => {
  const today = '2026-04-22';

  it('no plan, no actual → empty', () => {
    expect(getCellState(null, null, '2026-04-22', today)).toBe('empty');
  });

  it('plan exists, no actual, future date → planned-future', () => {
    expect(getCellState(mkPlan('m1', '2026-04-30'), null, '2026-04-30', today))
      .toBe('planned-future');
  });

  it('plan exists, no actual, more than 2 days late → overdue', () => {
    expect(getCellState(mkPlan('m1', '2026-04-15'), null, '2026-04-15', today))
      .toBe('overdue');
  });

  it('plan exists, no actual, within 2 days late or today → planned-past', () => {
    expect(getCellState(mkPlan('m1', '2026-04-21'), null, '2026-04-21', today))
      .toBe('planned-past');
    expect(getCellState(mkPlan('m1', '2026-04-22'), null, '2026-04-22', today))
      .toBe('planned-past');
  });

  it('plan exists, actual on plan date → done-on-time', () => {
    expect(getCellState(
      mkPlan('m1', '2026-04-20'),
      mkActual('m1', '2026-04-20'),
      '2026-04-20',
      today,
    )).toBe('done-on-time');
  });

  it('plan exists, actual 1 day after plan → done-delayed-minor', () => {
    expect(getCellState(
      mkPlan('m1', '2026-04-20'),
      mkActual('m1', '2026-04-21'),
      '2026-04-20',
      today,
    )).toBe('done-delayed-minor');
  });

  it('plan exists, actual 3 days after plan → done-delayed-major', () => {
    expect(getCellState(
      mkPlan('m1', '2026-04-20'),
      mkActual('m1', '2026-04-23'),
      '2026-04-20',
      today,
    )).toBe('done-delayed-major');
  });
});

describe('getOverdueMachines', () => {
  const today = '2026-04-22';

  it('returns machines with overdue plans (>2 days, no actual)', () => {
    const plans = [
      mkPlan('m1', '2026-04-15'), // overdue, no actual
      mkPlan('m2', '2026-04-21'), // recent past, only 1 day
      mkPlan('m3', '2026-04-15'), // overdue but actual exists
      mkPlan('m4', '2026-04-30'), // future
    ];
    const actuals = [mkActual('m3', '2026-04-16')];
    expect(getOverdueMachines(plans, actuals, today).sort()).toEqual(['m1']);
  });

  it('returns empty array when nothing is overdue', () => {
    expect(getOverdueMachines([mkPlan('m1', '2026-04-30')], [], today)).toEqual([]);
  });
});

describe('filterMachinesByLine', () => {
  const machines = [
    mkMachine({ id: 'a', line: 'SFM' }),
    mkMachine({ id: 'b', line: 'SFM' }),
    mkMachine({ id: 'c', line: 'RFM', group_name: 'RFM Line' }),
  ];

  it("'SFM' returns only SFM machines", () => {
    const out = filterMachinesByLine(machines, 'SFM');
    expect(out.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it("'All' returns all machines", () => {
    expect(filterMachinesByLine(machines, 'All')).toHaveLength(3);
  });
});

describe('groupMachinesByGroup', () => {
  it('groups across all 7 documented groups', () => {
    const machines: PmMachine[] = [
      mkMachine({ id: '1', line: 'SFM', group_name: 'Printing',  display_order: 1 }),
      mkMachine({ id: '2', line: 'SFM', group_name: 'C&C',       display_order: 3 }),
      mkMachine({ id: '3', line: 'SFM', group_name: 'VA',        display_order: 6 }),
      mkMachine({ id: '4', line: 'SFM', group_name: 'F&G',       display_order: 14 }),
      mkMachine({ id: '5', line: 'SFM', group_name: 'Pre-Press', display_order: 18 }),
      mkMachine({ id: '6', line: 'SFM', group_name: 'Others',    display_order: 20, is_critical: false }),
      mkMachine({ id: '7', line: 'RFM', group_name: 'RFM Line',  display_order: 21 }),
    ];
    const groups = groupMachinesByGroup(machines);
    expect(Object.keys(groups).sort()).toEqual([
      'RFM — RFM Line',
      'SFM — C&C',
      'SFM — F&G',
      'SFM — Others',
      'SFM — Pre-Press',
      'SFM — Printing',
      'SFM — VA',
    ]);
    expect(groups['SFM — Printing']).toHaveLength(1);
  });

  it('sorts machines inside a group by display_order', () => {
    const machines: PmMachine[] = [
      mkMachine({ id: 'b', line: 'SFM', group_name: 'VA', display_order: 9 }),
      mkMachine({ id: 'a', line: 'SFM', group_name: 'VA', display_order: 6 }),
    ];
    const groups = groupMachinesByGroup(machines);
    expect(groups['SFM — VA'].map((m) => m.id)).toEqual(['a', 'b']);
  });
});

describe('daysOfMonth', () => {
  it('returns 30 days for April', () => {
    expect(daysOfMonth(new Date(2026, 3, 1))).toHaveLength(30);
  });
  it('returns 28 days for Feb 2026', () => {
    expect(daysOfMonth(new Date(2026, 1, 1))).toHaveLength(28);
  });
});
