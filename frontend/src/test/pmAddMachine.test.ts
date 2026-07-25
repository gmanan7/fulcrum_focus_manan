import { describe, it, expect } from 'vitest';
import { validateNewMachine } from '@/lib/pmSchedule';
import type { PmMachine } from '@/types/pm';

const existing: PmMachine[] = [
  {
    id: '1', factory_id: 'f', line: 'SFM', group_name: 'Printing',
    name: 'Heidelberg - 1', is_critical: true, is_active: true,
    display_order: 0, created_at: '', updated_at: '',
  },
];

describe('validateNewMachine', () => {
  it('rejects empty name', () => {
    expect(validateNewMachine({ name: '', group: 'Printing', line: 'SFM' }))
      .toBe('Name is required');
  });

  it('rejects empty group', () => {
    expect(validateNewMachine({ name: 'Test', group: '', line: 'SFM' }))
      .toBe('Group is required');
  });

  it('rejects duplicate name+line', () => {
    expect(validateNewMachine(
      { name: 'Heidelberg - 1', group: 'Printing', line: 'SFM' },
      existing,
    )).toBe('A machine with this name already exists in SFM');
  });

  it('accepts unique new machine', () => {
    expect(validateNewMachine(
      { name: 'New Machine', group: 'Printing', line: 'SFM' },
      existing,
    )).toBeNull();
  });

  it('allows same name in different line', () => {
    expect(validateNewMachine(
      { name: 'Heidelberg - 1', group: 'Printing', line: 'RFM' },
      existing,
    )).toBeNull();
  });
});
