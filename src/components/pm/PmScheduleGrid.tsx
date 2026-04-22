import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { PmMachine, PmPlan, PmActual } from '@/types/pm';
import {
  toIsoDate,
  daysOfMonth,
  getCellState,
  groupMachinesByGroup,
  type CellState,
} from '@/lib/pmSchedule';
import {
  buildGridSummary,
  getOverdueBannerText,
  formatPmTooltip,
} from '@/lib/pmGridDisplay';
import { cn } from '@/lib/utils';

type LineFilter = 'SFM' | 'RFM' | 'ALL';

interface Props {
  month: Date;
  line: LineFilter;
  height?: 'compact' | 'full';
  showLink?: boolean;
}

const SUMMARY_COLOR_VARS: Record<string, { color: string; bg: string }> = {
  green: { color: 'var(--rag-green-border)', bg: 'var(--rag-green-bg)' },
  amber: { color: 'var(--rag-amber-border)', bg: 'var(--rag-amber-bg)' },
  red: { color: 'var(--rag-red-border)', bg: 'var(--rag-red-bg)' },
  grey: { color: 'var(--text-muted)', bg: 'var(--rag-missing-bg)' },
};

export function PmScheduleGrid({ month, line, height = 'compact', showLink = true }: Props) {
  const compact = height === 'compact';
  const cellPx = compact ? 24 : 32;
  const bubblePx = compact ? 14 : 18;
  const headerFont = compact ? 10 : 12;
  const nameColPx = compact ? 120 : 160;

  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const days = useMemo(() => daysOfMonth(month), [month]);
  const monthStart = days[0] ? toIsoDate(days[0]) : `${monthKey}-01`;
  const monthEnd = days[days.length - 1] ? toIsoDate(days[days.length - 1]) : `${monthKey}-31`;
  const today = toIsoDate(new Date());

  const { data: machines, isLoading: mLoading } = useQuery({
    queryKey: ['pm-grid-machines', line],
    queryFn: async () => {
      let q = supabase.from('pm_machines').select('*').eq('is_active', true);
      if (line !== 'ALL') q = q.eq('line', line);
      const { data, error } = await q.order('line').order('group_name').order('display_order');
      if (error) throw error;
      return (data || []) as PmMachine[];
    },
  });

  const machineIds = useMemo(() => (machines ?? []).map((m) => m.id), [machines]);

  const { data: plans } = useQuery({
    queryKey: ['pm-grid-plans', monthStart, monthEnd, machineIds.join(',')],
    queryFn: async () => {
      if (!machineIds.length) return [] as PmPlan[];
      const { data, error } = await supabase
        .from('pm_plan')
        .select('*')
        .in('machine_id', machineIds)
        .gte('planned_date', monthStart)
        .lte('planned_date', monthEnd);
      if (error) throw error;
      return (data || []) as PmPlan[];
    },
    enabled: machineIds.length > 0,
  });

  const { data: actuals } = useQuery({
    queryKey: ['pm-grid-actuals', monthStart, monthEnd, machineIds.join(',')],
    queryFn: async () => {
      if (!machineIds.length) return [] as PmActual[];
      const { data, error } = await supabase
        .from('pm_actual')
        .select('*')
        .in('machine_id', machineIds)
        .gte('actual_date', monthStart)
        .lte('actual_date', monthEnd);
      if (error) throw error;
      return (data || []) as PmActual[];
    },
    enabled: machineIds.length > 0,
  });

  const grouped = useMemo(() => groupMachinesByGroup(machines ?? []), [machines]);

  // Index plans/actuals by machine_id for fast lookup
  const planByMachine = useMemo(() => {
    const m: Record<string, PmPlan[]> = {};
    (plans ?? []).forEach((p) => {
      (m[p.machine_id] ??= []).push(p);
    });
    return m;
  }, [plans]);

  const actualByMachine = useMemo(() => {
    const m: Record<string, PmActual[]> = {};
    (actuals ?? []).forEach((a) => {
      (m[a.machine_id] ??= []).push(a);
    });
    return m;
  }, [actuals]);

  // Per-machine "row is overdue" flag (any plan overdue without actual)
  const overdueRowSet = useMemo(() => {
    const out = new Set<string>();
    (machines ?? []).forEach((m) => {
      const ps = planByMachine[m.id] ?? [];
      const as = actualByMachine[m.id] ?? [];
      for (const p of ps) {
        const matched = as.some((a) => a.actual_date >= p.planned_date);
        if (!matched && p.planned_date < today) {
          // overdue if more than 2 days late
          const daysLate = Math.round(
            (new Date(today + 'T00:00').getTime() - new Date(p.planned_date + 'T00:00').getTime()) / 86_400_000,
          );
          if (daysLate > 2) {
            out.add(m.id);
            break;
          }
        }
      }
    });
    return out;
  }, [machines, planByMachine, actualByMachine, today]);

  const overdueCount = overdueRowSet.size;
  const bannerText = getOverdueBannerText(overdueCount);

  if (mLoading) {
    return (
      <div className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>
        Loading PM schedule…
      </div>
    );
  }

  if (!machines || machines.length === 0) {
    return (
      <div className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>
        No machines configured for {line === 'ALL' ? 'this line' : line}.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {bannerText && (
        <div
          className="flex items-center gap-2 px-2 py-1.5 rounded text-xs"
          style={{
            background: 'var(--rag-red-bg)',
            color: 'var(--rag-red-border)',
            border: '1px solid var(--rag-red-badge-border)',
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">⚠ {bannerText}</span>
        </div>
      )}

      <div
        className="overflow-x-auto rounded border"
        style={{ borderColor: 'var(--border-card)', background: 'var(--bg-card)' }}
      >
        <table className="border-collapse" style={{ minWidth: 'max-content' }}>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 text-left font-semibold px-2"
                style={{
                  minWidth: nameColPx,
                  width: nameColPx,
                  fontSize: headerFont,
                  height: cellPx,
                  background: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  borderRight: '1px solid var(--border-card)',
                  borderBottom: '1px solid var(--border-card)',
                }}
              >
                Machine
              </th>
              {days.map((d) => {
                const iso = toIsoDate(d);
                const isToday = iso === today;
                const isPast = iso < today;
                return (
                  <th
                    key={iso}
                    className="text-center font-medium"
                    style={{
                      width: cellPx,
                      minWidth: cellPx,
                      height: cellPx,
                      fontSize: headerFont,
                      color: isToday ? 'var(--color-primary)' : isPast ? 'var(--text-muted)' : 'var(--text-secondary)',
                      borderBottom: '1px solid var(--border-card)',
                      background: isToday ? 'var(--rag-missing-bg)' : undefined,
                    }}
                  >
                    {d.getDate()}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([groupKey, gMachines]) => {
              const summary = buildGridSummary(gMachines, plans ?? [], actuals ?? [], monthKey, today);
              const sc = SUMMARY_COLOR_VARS[summary.color];
              return (
                <GroupBlock
                  key={groupKey}
                  groupKey={groupKey}
                  machines={gMachines}
                  days={days}
                  cellPx={cellPx}
                  bubblePx={bubblePx}
                  nameColPx={nameColPx}
                  headerFont={headerFont}
                  today={today}
                  planByMachine={planByMachine}
                  actualByMachine={actualByMachine}
                  overdueRowSet={overdueRowSet}
                  summaryText={
                    summary.total > 0
                      ? `${summary.done} / ${summary.total} machines PM done this month`
                      : 'No PM scheduled this month'
                  }
                  summaryColor={sc.color}
                  summaryBg={sc.bg}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {showLink && (
        <div className="flex justify-end">
          <Link
            to="/pm-schedule"
            className="text-xs font-medium hover:underline inline-flex items-center gap-1"
            style={{ color: 'var(--color-primary)' }}
          >
            View Full <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function GroupBlock({
  groupKey,
  machines,
  days,
  cellPx,
  bubblePx,
  nameColPx,
  headerFont,
  today,
  planByMachine,
  actualByMachine,
  overdueRowSet,
  summaryText,
  summaryColor,
  summaryBg,
}: {
  groupKey: string;
  machines: PmMachine[];
  days: Date[];
  cellPx: number;
  bubblePx: number;
  nameColPx: number;
  headerFont: number;
  today: string;
  planByMachine: Record<string, PmPlan[]>;
  actualByMachine: Record<string, PmActual[]>;
  overdueRowSet: Set<string>;
  summaryText: string;
  summaryColor: string;
  summaryBg: string;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={days.length + 1}
          className="sticky left-0 z-10 px-2 py-1 font-semibold"
          style={{
            background: 'var(--rag-missing-bg)',
            color: 'var(--text-secondary)',
            fontSize: headerFont,
            borderBottom: '1px solid var(--border-card)',
            borderTop: '1px solid var(--border-card)',
          }}
        >
          {groupKey}
        </td>
      </tr>
      {machines.map((m) => {
        const isOverdueRow = overdueRowSet.has(m.id);
        const rowBg = isOverdueRow ? 'var(--rag-red-bg)' : undefined;
        return (
          <tr key={m.id} style={{ background: rowBg }}>
            <td
              className="sticky left-0 z-10 px-2 truncate"
              style={{
                width: nameColPx,
                minWidth: nameColPx,
                height: cellPx,
                fontSize: headerFont,
                color: 'var(--text-primary)',
                fontStyle: m.is_critical ? 'normal' : 'italic',
                opacity: m.is_critical ? 1 : 0.75,
                background: rowBg ?? 'var(--bg-card)',
                borderRight: '1px solid var(--border-card)',
                borderBottom: '1px solid var(--border-card)',
              }}
              title={m.name}
            >
              {m.name}
            </td>
            {days.map((d) => {
              const iso = toIsoDate(d);
              const plan = (planByMachine[m.id] ?? []).find((p) => p.planned_date === iso) ?? null;
              const actual = (actualByMachine[m.id] ?? []).find((a) => a.actual_date === iso) ?? null;
              const state = getCellState(plan, actual, iso, today);
              const tooltip = formatPmTooltip(
                state,
                plan?.planned_date ?? null,
                actual?.actual_date ?? null,
                actual?.remarks ?? null,
                today,
              );
              return (
                <td
                  key={iso}
                  title={tooltip || undefined}
                  style={{
                    width: cellPx,
                    minWidth: cellPx,
                    height: cellPx,
                    textAlign: 'center',
                    verticalAlign: 'middle',
                    borderBottom: '1px solid var(--border-card)',
                    borderRight: '1px solid var(--border-card)',
                  }}
                >
                  <Bubble state={state} size={bubblePx} />
                </td>
              );
            })}
          </tr>
        );
      })}
      <tr>
        <td
          colSpan={days.length + 1}
          className="px-2 py-1 text-right"
          style={{
            background: summaryBg,
            color: summaryColor,
            fontSize: headerFont,
            fontWeight: 600,
            borderBottom: '1px solid var(--border-card)',
          }}
        >
          {summaryText}
        </td>
      </tr>
    </>
  );
}

function Bubble({ state, size }: { state: CellState; size: number }) {
  if (state === 'empty') return null;
  const stroke = 1.5;
  const small = Math.max(6, Math.floor(size * 0.55));

  if (state === 'planned-future' || state === 'planned-past') {
    return <Hollow size={size} color="var(--color-primary)" strokeWidth={stroke} />;
  }
  if (state === 'overdue') {
    return <Hollow size={size} color="var(--rag-red-border)" strokeWidth={stroke} />;
  }
  if (state === 'done-on-time') {
    return <Filled size={size} color="var(--rag-green-border)" />;
  }
  if (state === 'done-delayed-minor') {
    return (
      <span className="inline-flex flex-col items-center justify-center">
        <Filled size={size} color="var(--rag-amber-border)" />
        <Hollow size={small} color="var(--color-primary)" strokeWidth={1} />
      </span>
    );
  }
  if (state === 'done-delayed-major') {
    return (
      <span className="inline-flex flex-col items-center justify-center">
        <Filled size={size} color="var(--rag-red-border)" />
        <Hollow size={small} color="var(--color-primary)" strokeWidth={1} />
      </span>
    );
  }
  return null;
}

function Filled({ size, color }: { size: number; color: string }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{ width: size, height: size, background: color }}
      aria-hidden
    />
  );
}

function Hollow({ size, color, strokeWidth }: { size: number; color: string; strokeWidth: number }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        border: `${strokeWidth}px solid ${color}`,
        background: 'transparent',
      }}
      aria-hidden
    />
  );
}

export default PmScheduleGrid;
