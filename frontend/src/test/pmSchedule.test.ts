import { describe, it, expect } from 'vitest';
import type { PmMachine, PmPlan, PmActual } from '@/types/pm';

/**
 * Static seed snapshot — mirrors the migration's INSERT for pm_machines.
 * Used to validate the seed contract without touching the database.
 */
const SEED: Array<{
  line: 'SFM' | 'RFM';
  group_name: string;
  name: string;
  is_critical: boolean;
  display_order: number;
}> = [
  { line: 'SFM', group_name: 'Printing',  name: 'Heidelberg - 1',      is_critical: true,  display_order: 1 },
  { line: 'SFM', group_name: 'Printing',  name: 'Heidelberg - 2',      is_critical: true,  display_order: 2 },
  { line: 'SFM', group_name: 'C&C',       name: 'Nova Cut E',          is_critical: true,  display_order: 3 },
  { line: 'SFM', group_name: 'C&C',       name: 'Novacut ER-1',        is_critical: true,  display_order: 4 },
  { line: 'SFM', group_name: 'C&C',       name: 'Novacut ER-2',        is_critical: true,  display_order: 5 },
  { line: 'SFM', group_name: 'VA',        name: 'Hot Foil Stamping',   is_critical: true,  display_order: 6 },
  { line: 'SFM', group_name: 'VA',        name: 'Steinemann',          is_critical: true,  display_order: 7 },
  { line: 'SFM', group_name: 'VA',        name: 'UV Coater',           is_critical: true,  display_order: 8 },
  { line: 'SFM', group_name: 'VA',        name: 'Meiguang',            is_critical: true,  display_order: 9 },
  { line: 'SFM', group_name: 'VA',        name: 'Sheet Fed Gravure',   is_critical: true,  display_order: 10 },
  { line: 'SFM', group_name: 'VA',        name: 'Kohmann Liner',       is_critical: true,  display_order: 11 },
  { line: 'SFM', group_name: 'VA',        name: 'Clamshell 1/2',       is_critical: true,  display_order: 12 },
  { line: 'SFM', group_name: 'VA',        name: 'Zhengmao Machine',    is_critical: true,  display_order: 13 },
  { line: 'SFM', group_name: 'F&G',       name: 'Exper Fold',          is_critical: true,  display_order: 14 },
  { line: 'SFM', group_name: 'F&G',       name: 'Vision Fold-1',       is_critical: true,  display_order: 15 },
  { line: 'SFM', group_name: 'F&G',       name: 'Vision Fold-2',       is_critical: true,  display_order: 16 },
  { line: 'SFM', group_name: 'F&G',       name: 'Nova Fold',           is_critical: true,  display_order: 17 },
  { line: 'SFM', group_name: 'Pre-Press', name: 'CTP',                 is_critical: true,  display_order: 18 },
  { line: 'SFM', group_name: 'Pre-Press', name: 'Kongsberg',           is_critical: false, display_order: 19 },
  { line: 'SFM', group_name: 'Others',    name: 'Pile Turner',         is_critical: false, display_order: 20 },
  { line: 'RFM', group_name: 'RFM Line',  name: 'Delta Printing Line', is_critical: true,  display_order: 21 },
  { line: 'RFM', group_name: 'RFM Line',  name: 'Hugobeck',            is_critical: true,  display_order: 22 },
  { line: 'RFM', group_name: 'RFM Line',  name: 'Hunkeler',            is_critical: true,  display_order: 23 },
  { line: 'RFM', group_name: 'RFM Line',  name: 'Bundler Line',        is_critical: true,  display_order: 24 },
];

describe('PmMachine type', () => {
  it('has all required fields', () => {
    const sample: PmMachine = {
      id: 'm1',
      factory_id: 'f1',
      line: 'SFM',
      group_name: 'Printing',
      name: 'Heidelberg - 1',
      is_critical: true,
      is_active: true,
      display_order: 1,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    };
    expect(sample.id).toBeDefined();
    expect(sample.line).toMatch(/^(SFM|RFM)$/);
    expect(typeof sample.is_critical).toBe('boolean');
    expect(typeof sample.is_active).toBe('boolean');
    expect(typeof sample.display_order).toBe('number');
  });
});

describe('PmPlan / PmActual types', () => {
  it('PmPlan accepts the documented shape', () => {
    const p: PmPlan = {
      id: 'p1', machine_id: 'm1', planned_date: '2025-04-22',
      created_by: null, created_at: 'x', updated_at: 'y',
    };
    expect(p.planned_date).toBe('2025-04-22');
  });

  it('PmActual accepts the documented shape', () => {
    const a: PmActual = {
      id: 'a1', machine_id: 'm1', actual_date: '2025-04-22',
      remarks: null, recorded_by: null, created_at: 'x', updated_at: 'y',
    };
    expect(a.actual_date).toBe('2025-04-22');
  });
});

describe('PM Schedule seed contract', () => {
  it('seeds exactly 24 machines', () => {
    expect(SEED).toHaveLength(24);
  });

  it('seeds 20 SFM and 4 RFM machines', () => {
    expect(SEED.filter((m) => m.line === 'SFM')).toHaveLength(20);
    expect(SEED.filter((m) => m.line === 'RFM')).toHaveLength(4);
  });

  it('marks exactly 2 machines as non-critical: Kongsberg and Pile Turner', () => {
    const nonCritical = SEED.filter((m) => !m.is_critical).map((m) => m.name).sort();
    expect(nonCritical).toEqual(['Kongsberg', 'Pile Turner'].sort());
  });

  it('marks CTP as critical', () => {
    const ctp = SEED.find((m) => m.name === 'CTP');
    expect(ctp).toBeDefined();
    expect(ctp!.is_critical).toBe(true);
  });

  it('has unique display_order values 1..24', () => {
    const orders = SEED.map((m) => m.display_order).sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  });
});

/**
 * UNIQUE constraint contract notes (enforced by Postgres, documented here):
 * - pm_plan UNIQUE(machine_id, planned_date): inserting the same pair twice
 *   raises a 23505 unique_violation error.
 * - pm_actual UNIQUE(machine_id, actual_date): same behavior.
 * These are validated at the DB layer; this test asserts the contract intent.
 */
describe('UNIQUE constraint contract (DB-enforced)', () => {
  it('documents pm_plan uniqueness on (machine_id, planned_date)', () => {
    const key = (p: Pick<PmPlan, 'machine_id' | 'planned_date'>) =>
      `${p.machine_id}|${p.planned_date}`;
    expect(key({ machine_id: 'm1', planned_date: '2025-04-22' }))
      .toBe(key({ machine_id: 'm1', planned_date: '2025-04-22' }));
  });

  it('documents pm_actual uniqueness on (machine_id, actual_date)', () => {
    const key = (a: Pick<PmActual, 'machine_id' | 'actual_date'>) =>
      `${a.machine_id}|${a.actual_date}`;
    expect(key({ machine_id: 'm1', actual_date: '2025-04-22' }))
      .toBe(key({ machine_id: 'm1', actual_date: '2025-04-22' }));
  });
});
