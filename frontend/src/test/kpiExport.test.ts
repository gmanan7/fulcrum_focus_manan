import { describe, it, expect } from 'vitest';
import {
  buildExcelSummaryRows,
  buildDailyDataRows,
  buildMtdRows,
  formatDateForExcel,
  generateExportFilename,
  type KpiMaster,
  type KpiEntry,
  type DepartmentRef,
} from '@/lib/kpiExport';

const depts: DepartmentRef[] = [
  { id: 'd1', name: 'Production' },
  { id: 'd2', name: 'Quality' },
];

const kpis: KpiMaster[] = [
  { id: 'k1', name: 'Output', unit: 'Mn HLP', target_value: 100, direction: 'higher_is_better', mtd_aggregation: 'sum', department_id: 'd1' },
  { id: 'k2', name: 'Defect Rate', unit: '%', target_value: 2, direction: 'lower_is_better', mtd_aggregation: 'average', department_id: 'd2' },
];

describe('formatDateForExcel', () => {
  it('formats yyyy-MM-dd to DD/MM/YYYY', () => {
    expect(formatDateForExcel('2026-04-23')).toBe('23/04/2026');
  });
});

describe('generateExportFilename', () => {
  it('builds xlsx filename with year-month', () => {
    expect(generateExportFilename('xlsx', new Date('2026-04-15T00:00:00'))).toBe('KPI_Data_2026-04_ITC_PPB_NPF.xlsx');
  });
  it('builds pdf filename with full date', () => {
    expect(generateExportFilename('pdf', new Date('2026-04-23T00:00:00'))).toBe('KPI_Report_2026-04-23_ITC_PPB_NPF.pdf');
  });
});

describe('buildExcelSummaryRows', () => {
  it('returns one row per KPI with the expected columns', () => {
    const rows = buildExcelSummaryRows(kpis, depts);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      Department: 'Production',
      'KPI Name': 'Output',
      Unit: 'Mn HLP',
      Target: 100,
      Direction: 'higher_is_better',
      'MTD Aggregation': 'sum',
    });
  });
});

describe('buildDailyDataRows', () => {
  const entries: KpiEntry[] = [
    { id: 'e1', kpi_id: 'k1', reporting_date: '2026-04-10', actual_value: 90, computed_status: 'amber', is_late_entry: false, submitter: { full_name: 'Alice' } },
    { id: 'e2', kpi_id: 'k2', reporting_date: '2026-04-12', actual_value: 1.5, computed_status: 'green', is_late_entry: true, submitter: { full_name: 'Bob' } },
  ];
  it('maps fields and sorts by date desc', () => {
    const rows = buildDailyDataRows(entries, kpis, depts);
    expect(rows).toHaveLength(2);
    expect(rows[0]['KPI Name']).toBe('Defect Rate');
    expect(rows[0].Date).toBe('12/04/2026');
    expect(rows[0]['Late Entry']).toBe('Yes');
    expect(rows[0]['Submitted By']).toBe('Bob');
    expect(rows[1]['Actual Value']).toBe(90);
  });
});

describe('buildMtdRows', () => {
  it('returns one row per KPI', () => {
    const ref = new Date('2026-04-15T00:00:00');
    const entries: KpiEntry[] = [
      { id: 'e1', kpi_id: 'k1', reporting_date: '2026-04-01', actual_value: 50, computed_status: 'green', is_late_entry: false },
      { id: 'e2', kpi_id: 'k1', reporting_date: '2026-04-10', actual_value: 60, computed_status: 'green', is_late_entry: false },
    ];
    const rows = buildMtdRows(kpis, entries, depts, ref);
    expect(rows).toHaveLength(2);
    const k1 = rows.find((r) => r['KPI Name'] === 'Output');
    expect(k1?.['MTD Value']).toBe(110);
    const k2 = rows.find((r) => r['KPI Name'] === 'Defect Rate');
    expect(k2?.['MTD Value']).toBeNull();
  });
});
