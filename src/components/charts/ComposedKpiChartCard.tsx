import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { autoColor, mergeComposedChartData, type ComposedKpiEntry } from '@/lib/composedChart';
import { formatIndianNumber } from '@/lib/formatNumber';
import { clampSpan } from '@/lib/composedChart';

interface ChartKpi {
  kpi_id: string;
  render_as: 'line' | 'bar';
  axis: 'primary' | 'secondary';
  color: string | null;
  display_order: number;
  kpi: {
    id: string;
    name: string;
    unit: string | null;
  };
}

export interface ComposedChartDef {
  id: string;
  name: string;
  size_width: number;
  size_height: number;
  chart_type: 'line' | 'bar' | 'composed';
  display_order: number;
  kpi_chart_kpis: ChartKpi[];
}

interface Props {
  chart: ComposedChartDef;
  entriesByKpi: Record<string, ComposedKpiEntry[]>;
  /** Current breakpoint column count (1 mobile, 2 tablet, 3 desktop, 4 xl) */
  columns: number;
}

export function ComposedKpiChartCard({ chart, entriesByKpi, columns }: Props) {
  const orderedKpis = useMemo(
    () => [...chart.kpi_chart_kpis].sort((a, b) => a.display_order - b.display_order),
    [chart.kpi_chart_kpis]
  );

  const data = useMemo(
    () => mergeComposedChartData(orderedKpis.map((k) => k.kpi_id), entriesByKpi),
    [orderedKpis, entriesByKpi]
  );

  const hasSecondary = orderedKpis.some((k) => k.axis === 'secondary');
  const colSpan = clampSpan(chart.size_width, columns);
  const rowSpan = columns <= 1 ? 1 : Math.max(1, chart.size_height);

  // Chart-type override
  const effectiveRender = (k: ChartKpi): 'line' | 'bar' => {
    if (chart.chart_type === 'line') return 'line';
    if (chart.chart_type === 'bar') return 'bar';
    return k.render_as;
  };

  const colorFor = (k: ChartKpi, idx: number) => k.color || autoColor(idx);

  // Height scales with row span. Base 220 px.
  const height = 200 * rowSpan + (rowSpan - 1) * 32;

  const spanClass = [
    colSpan === 2 ? 'sm:col-span-2' : '',
    colSpan === 3 ? 'lg:col-span-3' : '',
    rowSpan === 2 ? 'sm:row-span-2' : '',
    rowSpan === 3 ? 'sm:row-span-3' : '',
  ].filter(Boolean).join(' ');

  return (
    <Card
      className={`themed-card ${spanClass}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: 'var(--shadow-card)' }}
      data-testid={`composed-chart-${chart.id}`}
      data-col-span={colSpan}
      data-row-span={rowSpan}
    >
      <CardContent className="p-4">
        <div className="mb-2">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{chart.name}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {orderedKpis.map((k) => k.kpi?.name).filter(Boolean).join(', ')}
          </p>
        </div>

        {data.length === 0 ? (
          <div
            className="flex items-center justify-center"
            style={{ height, background: 'var(--rag-missing-bg)', borderRadius: 8 }}
          >
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No entries for this period</p>
          </div>
        ) : (
          <div style={{ background: 'var(--chart-bg)', borderRadius: 8 }}>
            <ResponsiveContainer width="100%" height={height}>
              <ComposedChart data={data as any[]} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="reporting_date"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(d) => format(parseISO(d), 'dd/MM')}
                />
                <YAxis
                  yAxisId="primary"
                  tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => formatIndianNumber(typeof v === 'number' ? v : Number(v))}
                />
                {hasSecondary && (
                  <YAxis
                    yAxisId="secondary"
                    orientation="right"
                    tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tickFormatter={(v) => formatIndianNumber(typeof v === 'number' ? v : Number(v))}
                  />
                )}
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null;
                    const dateStr = label ? format(parseISO(label), 'dd MMM yyyy') : '';
                    const visible = payload.filter((p: any) => p.value != null);
                    if (visible.length === 0) return null;
                    return (
                      <div className="rounded-lg shadow-md p-3 text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
                        <p className="font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>{dateStr}</p>
                        {visible.map((p: any) => {
                          const k = orderedKpis.find((kk) => `kpi_${kk.kpi_id}` === p.dataKey);
                          return (
                            <p key={p.dataKey} className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                              <span
                                style={{ display: 'inline-block', width: 8, height: 8, background: p.color, borderRadius: 2 }}
                              />
                              <span>{p.name}:</span>
                              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {formatIndianNumber(p.value)}
                              </span>
                              {k?.kpi?.unit && (
                                <span style={{ color: 'var(--text-muted)' }}>{k.kpi.unit}</span>
                              )}
                            </p>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                {orderedKpis.map((k, idx) => {
                  const color = colorFor(k, idx);
                  const name = k.kpi?.name || k.kpi_id;
                  if (effectiveRender(k) === 'bar') {
                    return (
                      <Bar
                        key={k.kpi_id}
                        yAxisId={k.axis}
                        dataKey={`kpi_${k.kpi_id}`}
                        fill={color}
                        name={name}
                        barSize={16}
                      />
                    );
                  }
                  return (
                    <Line
                      key={k.kpi_id}
                      yAxisId={k.axis}
                      type="monotone"
                      dataKey={`kpi_${k.kpi_id}`}
                      stroke={color}
                      strokeWidth={2}
                      name={name}
                      dot={{ r: 3, fill: color, stroke: 'white', strokeWidth: 1 }}
                      connectNulls={false}
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
