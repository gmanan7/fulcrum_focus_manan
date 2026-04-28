import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const range = vi.fn();
  const order = vi.fn(() => ({ range }));
  const lte = vi.fn(() => ({ order }));
  const gte = vi.fn(() => ({ lte }));
  const select = vi.fn(() => ({ gte }));
  const from = vi.fn(() => ({ select }));

  return { from, select, gte, lte, order, range };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: mocks.from },
}));

import { fetchAllKpiEntries, KPI_ENTRIES_PAGE_SIZE } from '@/lib/kpiEntriesApi';

function rows(count: number, startIndex = 0) {
  return Array.from({ length: count }, (_, index) => ({
    id: `entry-${startIndex + index}`,
    reporting_date: '2026-04-01',
  }));
}

function mockPages(pages: Array<{ data: any[]; count?: number | null }>) {
  mocks.range.mockImplementation(() => {
    const next = pages.shift();
    return Promise.resolve({ data: next?.data ?? [], error: null, count: next?.count ?? null });
  });
}

describe('fetchAllKpiEntries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('makes 2 requests when total=1145 with page1=900 and page2=245', async () => {
    mockPages([
      { data: rows(KPI_ENTRIES_PAGE_SIZE), count: 1145 },
      { data: rows(245, KPI_ENTRIES_PAGE_SIZE), count: 1145 },
    ]);

    await fetchAllKpiEntries('2026-04-01', '2026-04-30');

    expect(mocks.range).toHaveBeenCalledTimes(2);
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 899);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 900, 1799);
  });

  it('makes 1 request when total=500', async () => {
    mockPages([{ data: rows(500), count: 500 }]);

    await fetchAllKpiEntries('2026-04-01', '2026-04-30');

    expect(mocks.range).toHaveBeenCalledTimes(1);
    expect(mocks.range).toHaveBeenCalledWith(0, 899);
  });

  it('returns all 1145 rows combined', async () => {
    mockPages([
      { data: rows(KPI_ENTRIES_PAGE_SIZE), count: 1145 },
      { data: rows(245, KPI_ENTRIES_PAGE_SIZE), count: 1145 },
    ]);

    const result = await fetchAllKpiEntries('2026-04-01', '2026-04-30');

    expect(result).toHaveLength(1145);
    expect(result[0].id).toBe('entry-0');
    expect(result[1144].id).toBe('entry-1144');
  });

  it('stops when page returns 0 rows', async () => {
    mockPages([{ data: [], count: 0 }]);

    const result = await fetchAllKpiEntries('2026-04-01', '2026-04-30');

    expect(result).toEqual([]);
    expect(mocks.range).toHaveBeenCalledTimes(1);
  });

  it('stops when page returns fewer than PAGE_SIZE rows', async () => {
    mockPages([{ data: rows(899), count: null }]);

    const result = await fetchAllKpiEntries('2026-04-01', '2026-04-30');

    expect(result).toHaveLength(899);
    expect(mocks.range).toHaveBeenCalledTimes(1);
  });

  it('keeps the correct first and last dates in the combined array', async () => {
    const firstPage = rows(KPI_ENTRIES_PAGE_SIZE);
    const secondPage = rows(245, KPI_ENTRIES_PAGE_SIZE);
    firstPage[0].reporting_date = '2026-04-01';
    secondPage[244].reporting_date = '2026-04-27';
    mockPages([
      { data: firstPage, count: 1145 },
      { data: secondPage, count: 1145 },
    ]);

    const result = await fetchAllKpiEntries('2026-04-01', '2026-04-30');

    expect(result[0].reporting_date).toBe('2026-04-01');
    expect(result[result.length - 1].reporting_date).toBe('2026-04-27');
  });
});