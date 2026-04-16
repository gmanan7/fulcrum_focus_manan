import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getPinnedKpis, reorderItems, isAtMaxPins, getAllKpisForMyView, groupKpisByDepartment, filterKpisBySearch, selectAllInDepartment } from '@/lib/myViewUtils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ChevronUp, ChevronDown, X, Pin, Search, Pencil, ArrowLeft,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip,
} from 'recharts';
import { subDays, format, parseISO } from 'date-fns';

type RagStatus = 'red' | 'amber' | 'green' | null;

interface PinnedRow {
  id: string;
  kpi_id: string;
  display_order: number;
}

interface KpiMasterRow {
  id: string;
  name: string;
  unit: string | null;
  target_value: number | null;
  department_id: string;
  kpi_type: string;
}

interface DeptRow {
  id: string;
  name: string;
  code: string;
}

const RAG_COLORS: Record<string, string> = {
  red: 'var(--rag-red)',
  amber: 'var(--rag-amber)',
  green: 'var(--rag-green)',
};

export default function MyView() {
  const { session, roles, hasAnyRole } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');

  const isShopFloorOnly = roles.length === 1 && roles[0] === 'shop_floor';
  const isDeptHead = roles.length === 1 && roles[0] === 'department_head';

  // Fetch pinned items
  const { data: pinnedItems = [], isLoading: loadingPinned } = useQuery({
    queryKey: ['my-view-items', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('my_view_items')
        .select('id, kpi_id, display_order')
        .eq('user_id', userId!)
        .order('display_order');
      if (error) throw error;
      return (data || []) as PinnedRow[];
    },
    enabled: !!userId,
  });

  // Fetch all numeric KPIs
  const { data: allKpis = [] } = useQuery({
    queryKey: ['kpi-master-numeric'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_master')
        .select('id, name, unit, target_value, department_id, kpi_type')
        .eq('is_active', true)
        .eq('kpi_type', 'numeric')
        .order('display_order');
      if (error) throw error;
      return (data || []) as KpiMasterRow[];
    },
  });

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('department')
        .select('id, name, code')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return (data || []) as DeptRow[];
    },
  });

  // For department_head: get user's departments
  const { data: userDeptIds = [] } = useQuery({
    queryKey: ['user-departments', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', userId!);
      if (error) throw error;
      return (data || []).map((d) => d.department_id);
    },
    enabled: !!userId && isDeptHead,
  });

  // Visible KPIs for edit mode (dept_head sees own dept only)
  const visibleKpis = useMemo(() => {
    let kpis = allKpis;
    if (isDeptHead && userDeptIds.length > 0) {
      kpis = kpis.filter((k) => userDeptIds.includes(k.department_id));
    }
    return filterAvailableKpis(kpis, search);
  }, [allKpis, search, isDeptHead, userDeptIds]);

  // Group by department
  const groupedKpis = useMemo(() => {
    const groups: Record<string, { dept: DeptRow; kpis: KpiMasterRow[] }> = {};
    visibleKpis.forEach((kpi) => {
      const dept = departments.find((d) => d.id === kpi.department_id);
      if (!dept) return;
      if (!groups[dept.id]) groups[dept.id] = { dept, kpis: [] };
      groups[dept.id].kpis.push(kpi);
    });
    return Object.values(groups);
  }, [visibleKpis, departments]);

  const pinnedKpiIds = new Set(pinnedItems.map((p) => p.kpi_id));
  const sorted = getPinnedKpis(pinnedItems);

  // Mutations
  const pinMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const { error } = await supabase.from('my_view_items').insert({
        user_id: userId!,
        kpi_id: kpiId,
        display_order: pinnedItems.length,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-view-items'] }),
  });

  const unpinMutation = useMutation({
    mutationFn: async (kpiId: string) => {
      const { error } = await supabase
        .from('my_view_items')
        .delete()
        .eq('user_id', userId!)
        .eq('kpi_id', kpiId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-view-items'] }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (newItems: PinnedRow[]) => {
      for (const item of newItems) {
        await supabase
          .from('my_view_items')
          .update({ display_order: item.display_order })
          .eq('id', item.id);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-view-items'] }),
  });

  const handleTogglePin = (kpiId: string) => {
    if (pinnedKpiIds.has(kpiId)) {
      unpinMutation.mutate(kpiId);
    } else {
      if (isAtMaxPins(pinnedItems.length)) {
        toast.warning('Maximum 12 KPIs. Unpin one to add another.');
        return;
      }
      pinMutation.mutate(kpiId);
    }
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const newOrder = reorderItems(sorted, index, direction);
    reorderMutation.mutate(newOrder);
  };

  if (loadingPinned) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: 'var(--bg-card)' }} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[200px] rounded-xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
          ))}
        </div>
      </div>
    );
  }

  // EDIT MODE
  if (editMode) {
    return (
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setEditMode(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              Edit My View
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {pinnedItems.length}/12 pinned
            </Badge>
            <Button size="sm" onClick={() => setEditMode(false)}>Done</Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
          <Input
            placeholder="Search KPIs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="space-y-4">
          {groupedKpis.map(({ dept, kpis }) => (
            <Card key={dept.id} className="overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
              <div className="px-4 py-2 font-medium text-sm" style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-card)' }}>
                {dept.name}
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border-card)' }}>
                {kpis.map((kpi) => (
                  <label
                    key={kpi.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  >
                    <Checkbox
                      checked={pinnedKpiIds.has(kpi.id)}
                      onCheckedChange={() => handleTogglePin(kpi.id)}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {kpi.name}
                      {kpi.unit && <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>({kpi.unit})</span>}
                    </span>
                  </label>
                ))}
              </div>
            </Card>
          ))}
          {groupedKpis.length === 0 && (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
              No KPIs found.
            </p>
          )}
        </div>
      </div>
    );
  }

  // EMPTY STATE
  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--rag-green-bg)' }}>
          <LayoutDashboard className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
        </div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Your personal KPI dashboard is empty</h1>
        <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
          Pin KPI trend charts to build your view.
        </p>
        <Button onClick={() => setEditMode(true)}>
          <Pin className="mr-2 h-4 w-4" />
          Set up My View
        </Button>
      </div>
    );
  }

  // POPULATED VIEW
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>My View</h1>
        <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit My View
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sorted.map((item, index) => (
          <KpiTrendCard
            key={item.kpi_id}
            kpiId={item.kpi_id}
            allKpis={allKpis}
            departments={departments}
            index={index}
            total={sorted.length}
            onMoveUp={() => handleMove(index, -1)}
            onMoveDown={() => handleMove(index, 1)}
            onUnpin={() => unpinMutation.mutate(item.kpi_id)}
          />
        ))}
      </div>
    </div>
  );
}

// ---- KPI Trend Card ----

function KpiTrendCard({
  kpiId,
  allKpis,
  departments,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onUnpin,
}: {
  kpiId: string;
  allKpis: KpiMasterRow[];
  departments: DeptRow[];
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUnpin: () => void;
}) {
  const kpi = allKpis.find((k) => k.id === kpiId);
  const dept = departments.find((d) => d.id === kpi?.department_id);
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

  const { data: entries = [] } = useQuery({
    queryKey: ['my-view-trend', kpiId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_entries')
        .select('reporting_date, actual_value, computed_status')
        .eq('kpi_id', kpiId)
        .gte('reporting_date', thirtyDaysAgo)
        .lte('reporting_date', yesterday)
        .order('reporting_date');
      if (error) throw error;
      return data || [];
    },
    enabled: !!kpiId,
    staleTime: 5 * 60 * 1000,
  });

  const chartData = entries.map((e) => ({
    date: format(parseISO(e.reporting_date), 'dd'),
    value: e.actual_value,
  }));

  const latestStatus: RagStatus = entries.length > 0
    ? (entries[entries.length - 1].computed_status as RagStatus)
    : null;

  const lineColor = latestStatus ? (RAG_COLORS[latestStatus] || 'var(--text-muted)') : 'var(--text-muted)';

  const statusLabel = latestStatus
    ? { red: '🔴', amber: '🟡', green: '🟢' }[latestStatus]
    : null;

  return (
    <Card
      className="relative overflow-hidden"
      style={{ background: 'var(--bg-card)', borderColor: 'var(--border-card)', minHeight: 200 }}
    >
      <div className="p-3 pb-0 flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>
            {dept?.name || 'Unknown'}
          </p>
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {kpi?.name || 'Unknown KPI'}
            {statusLabel && <span className="ml-1.5">{statusLabel}</span>}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveUp}
            disabled={index === 0}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onMoveDown}
            disabled={index === total - 1}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onUnpin}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="px-1 pb-2" style={{ height: 140 }}>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs" style={{ color: 'var(--text-muted)' }}>
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 9, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 8,
                  fontSize: 11,
                }}
              />
              {kpi?.target_value != null && (
                <ReferenceLine
                  y={kpi.target_value}
                  stroke="var(--text-muted)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                />
              )}
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
