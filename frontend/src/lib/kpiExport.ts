import { format } from 'date-fns';
import { calculateMtd } from './mtdUtils';

export type ExportFormat = 'xlsx' | 'pdf';

export interface KpiMaster {
  id: string;
  name: string;
  unit: string | null;
  target_value: number | null;
  direction: string;
  mtd_aggregation: string;
  department_id: string;
  kpi_type?: string;
}

export interface KpiEntry {
  id: string;
  kpi_id: string;
  reporting_date: string;
  actual_value: number | null;
  computed_status: string | null;
  is_late_entry: boolean;
  submitter?: { full_name: string } | null;
}

export interface DepartmentRef {
  id: string;
  name: string;
}

/** Format an ISO/Date value to DD/MM/YYYY for Excel output. */
export function formatDateForExcel(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date.length === 10 ? date + 'T00:00:00' : date) : date;
  return format(d, 'dd/MM/yyyy');
}

/** Build the filename used for KPI export downloads. */
export function generateExportFilename(fmt: ExportFormat, date: Date = new Date()): string {
  if (fmt === 'xlsx') {
    return `KPI_Data_${format(date, 'yyyy-MM')}_ITC_PPB_NPF.xlsx`;
  }
  return `KPI_Report_${format(date, 'yyyy-MM-dd')}_ITC_PPB_NPF.pdf`;
}

function deptName(deptId: string, depts: DepartmentRef[]): string {
  return depts.find((d) => d.id === deptId)?.name ?? '—';
}

/** Sheet 1 — one row per KPI with master attributes. */
export function buildExcelSummaryRows(
  kpis: KpiMaster[],
  depts: DepartmentRef[],
): Record<string, any>[] {
  return kpis.map((k) => ({
    Department: deptName(k.department_id, depts),
    'KPI Name': k.name,
    Unit: k.unit ?? '',
    Target: k.target_value,
    Direction: k.direction,
    'MTD Aggregation': k.mtd_aggregation,
  }));
}

/** Sheet 2 — one row per kpi_entries record sorted by date desc, dept, KPI. */
export function buildDailyDataRows(
  entries: KpiEntry[],
  kpis: KpiMaster[],
  depts: DepartmentRef[],
): Record<string, any>[] {
  const kpiMap = new Map(kpis.map((k) => [k.id, k]));
  const rows = entries
    .filter((e) => kpiMap.has(e.kpi_id))
    .map((e) => {
      const k = kpiMap.get(e.kpi_id)!;
      return {
        Department: deptName(k.department_id, depts),
        'KPI Name': k.name,
        Unit: k.unit ?? '',
        Date: formatDateForExcel(e.reporting_date),
        _sortDate: e.reporting_date,
        'Actual Value': e.actual_value,
        Status: e.computed_status ?? '',
        'Submitted By': e.submitter?.full_name ?? '',
        'Late Entry': e.is_late_entry ? 'Yes' : 'No',
      };
    });
  rows.sort((a, b) => {
    if (a._sortDate !== b._sortDate) return a._sortDate < b._sortDate ? 1 : -1;
    if (a.Department !== b.Department) return a.Department < b.Department ? -1 : 1;
    return a['KPI Name'] < b['KPI Name'] ? -1 : 1;
  });
  return rows.map(({ _sortDate, ...rest }) => rest);
}

/** Sheet 3 — one row per KPI showing current month MTD using kpi_master.mtd_aggregation. */
export function buildMtdRows(
  kpis: KpiMaster[],
  entries: KpiEntry[],
  depts: DepartmentRef[],
  referenceDate: Date = new Date(),
): Record<string, any>[] {
  const byKpi = new Map<string, KpiEntry[]>();
  entries.forEach((e) => {
    if (!byKpi.has(e.kpi_id)) byKpi.set(e.kpi_id, []);
    byKpi.get(e.kpi_id)!.push(e);
  });
  return kpis.map((k) => {
    const list = byKpi.get(k.id) ?? [];
    const mtd = calculateMtd(
      list.map((e) => ({ reporting_date: e.reporting_date, actual_value: e.actual_value })),
      (k.mtd_aggregation as any) ?? 'sum',
      referenceDate,
    );
    let status: string = '';
    if (mtd != null && k.target_value != null) {
      if (k.direction === 'higher_is_better') status = mtd >= k.target_value ? 'green' : 'red';
      else if (k.direction === 'lower_is_better') status = mtd <= k.target_value ? 'green' : 'red';
      else status = mtd === k.target_value ? 'green' : 'red';
    }
    return {
      Department: deptName(k.department_id, depts),
      'KPI Name': k.name,
      Unit: k.unit ?? '',
      Target: k.target_value,
      'MTD Value': mtd,
      'MTD Aggregation': k.mtd_aggregation,
      Status: status,
    };
  });
}
