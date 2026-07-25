import { DB } from '@/integrations/apiClient';

export const KPI_ENTRIES_PAGE_SIZE = 900;

const DEFAULT_KPI_ENTRIES_SELECT = '*,submitter:profiles!kpi_entries_submitted_by_fkey(full_name)';

export async function fetchAllKpiEntries(
  startDate: string,
  endDate: string,
  selectClause: string = DEFAULT_KPI_ENTRIES_SELECT,
) {
  const allData: any[] = [];
  let from = 0;
  let hasMore = true;
  let totalCount: number | null = null;

  while (hasMore) {
    const { data, error, count } = await DB
      .from('kpi_entries')
      .select(selectClause, { count: 'exact' })
      .gte('reporting_date', startDate)
      .lte('reporting_date', endDate)
      .order('reporting_date', { ascending: true })
      .range(from, from + KPI_ENTRIES_PAGE_SIZE - 1);

    if (error) throw error;

    if (count !== null && count !== undefined) {
      totalCount = count;
    }

    if (data && data.length > 0) {
      allData.push(...data);
      from += KPI_ENTRIES_PAGE_SIZE;
      hasMore = totalCount !== null ? allData.length < totalCount : data.length === KPI_ENTRIES_PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}