import { describe, it, expect } from 'vitest';
import {
  filterItemsForKpi,
  EMPTY_PROJECT_TRACKER_MESSAGE,
  type ProjectTrackerItem,
} from '@/lib/projectTrackerExpansion';

const items: ProjectTrackerItem[] = [
  { id: '1', kpi_id: 'K1', title: 'Job B', status: 'active', display_order: 2 },
  { id: '2', kpi_id: 'K1', title: 'Job A', status: 'completed', display_order: 1 },
  { id: '3', kpi_id: 'K2', title: 'Other', status: 'active', display_order: 1 },
  { id: '4', kpi_id: 'K1', title: 'Job C', status: 'dropped', display_order: 3 },
];

describe('filterItemsForKpi', () => {
  it('returns 3 items for K1, ignoring K2', () => {
    const result = filterItemsForKpi(items, 'K1');
    expect(result).toHaveLength(3);
    expect(result.every((i) => i.kpi_id === 'K1')).toBe(true);
  });

  it('sorts by display_order ascending', () => {
    const result = filterItemsForKpi(items, 'K1');
    expect(result.map((i) => i.title)).toEqual(['Job A', 'Job B', 'Job C']);
  });

  it('returns empty array when no items match the kpi_id', () => {
    expect(filterItemsForKpi(items, 'NOPE')).toEqual([]);
  });

  it('returns empty array when items is null/undefined/empty', () => {
    expect(filterItemsForKpi(null, 'K1')).toEqual([]);
    expect(filterItemsForKpi(undefined, 'K1')).toEqual([]);
    expect(filterItemsForKpi([], 'K1')).toEqual([]);
  });

  it('falls back to title when display_order is missing/equal', () => {
    const flat: ProjectTrackerItem[] = [
      { id: 'a', kpi_id: 'K', title: 'Beta', status: 'active' },
      { id: 'b', kpi_id: 'K', title: 'Alpha', status: 'active' },
    ];
    expect(filterItemsForKpi(flat, 'K').map((i) => i.title)).toEqual(['Alpha', 'Beta']);
  });

  it('exposes a stable empty-state message', () => {
    expect(EMPTY_PROJECT_TRACKER_MESSAGE).toBe('No items added yet');
  });
});
