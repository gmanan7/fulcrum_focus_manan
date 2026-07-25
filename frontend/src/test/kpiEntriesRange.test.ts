import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const filesToCheck = [
  'src/pages/KpiTrends.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/MyView.tsx',
  'src/pages/MeetingWorkspace.tsx',
  'src/pages/KpiEntry.tsx',
  'src/pages/Compliance.tsx',
];
const paginatedUtilityFile = 'src/lib/kpiEntriesApi.ts';

function listSourceFiles(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir)).flatMap((entry) => {
    const path = `${dir}/${entry}`;
    const stat = statSync(join(process.cwd(), path));
    if (stat.isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function extractKpiEntriesDateRangeQueries(source: string) {
  const lines = source.split('\n');
  const queries: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes(".from('kpi_entries')") && !lines[index].includes('.from("kpi_entries")')) {
      continue;
    }

    const queryLines: string[] = [];
    for (let cursor = index; cursor < Math.min(lines.length, index + 30); cursor += 1) {
      queryLines.push(lines[cursor]);
      if (lines[cursor].trim().endsWith(';')) break;
    }

    const query = queryLines.join('\n');
    if (query.includes(".gte('reporting_date'") || query.includes('.gte("reporting_date"') || query.includes(".lte('reporting_date'") || query.includes('.lte("reporting_date"')) {
      queries.push(query);
    }
  }

  return queries;
}

describe('kpi_entries date-range query row caps', () => {
  it('routes every kpi_entries reporting_date range query through the paginated helper', () => {
    const queries = [...filesToCheck, ...listSourceFiles('src/lib').filter((file) => file !== paginatedUtilityFile)]
      .flatMap((file) => extractKpiEntriesDateRangeQueries(readProjectFile(file)).map((query) => ({ file, query })));

    expect(queries).toEqual([]);
  });

  it('uses safe paginated slices under the 1000-row server cap', () => {
    const source = readProjectFile(paginatedUtilityFile);
    const [paginatedQuery] = extractKpiEntriesDateRangeQueries(source);

    expect(paginatedQuery).toContain(".from('kpi_entries')");
    expect(paginatedQuery).toContain(".gte('reporting_date'");
    expect(paginatedQuery).toContain(".lte('reporting_date'");
    expect(source).toContain('KPI_ENTRIES_PAGE_SIZE = 900');
    expect(paginatedQuery).toContain('from + KPI_ENTRIES_PAGE_SIZE - 1');
  });
});
