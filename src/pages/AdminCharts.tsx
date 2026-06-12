import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Plus, Pencil, Trash2, Loader2, LineChart as LineChartIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { canManageCharts } from '@/lib/chartAdmin';
import { ChartFormDialog } from '@/components/charts/ChartFormDialog';

export default function AdminCharts() {
  const { roles } = useAuth();
  const queryClient = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState(false);

  if (!canManageCharts(roles)) {
    return <Navigate to="/tasks" replace />;
  }

  const { data: charts, isLoading } = useQuery({
    queryKey: ['admin-charts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_charts')
        .select('*, creator:created_by(full_name), department:department_id(name), kpi_chart_kpis(kpi_id, kpi:kpi_id(name))')
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const nextDisplayOrder =
    (charts && charts.length > 0 ? Math.max(...charts.map((c: any) => c.display_order)) + 1 : 0);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete chart "${name}"? This cannot be undone.`)) return;
    const { error } = await supabase.from('kpi_charts').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Chart deleted' });
    queryClient.invalidateQueries({ queryKey: ['admin-charts'] });
  };

  const openNew = () => { setEditId(null); setOpenForm(true); };
  const openEdit = (id: string) => { setEditId(id); setOpenForm(true); };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">KPI Charts</h1>
          <p className="text-sm text-muted-foreground">Build multi-KPI charts shown on the KPI Trends page.</p>
        </div>
        <Button onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> New Chart</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : !charts || charts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <LineChartIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No charts yet. Create one to combine KPIs into a single visual.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>KPIs</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {charts.map((c: any) => {
                const kpiNames: string[] = (c.kpi_chart_kpis || [])
                  .map((l: any) => l.kpi?.name)
                  .filter(Boolean);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.size_width} × {c.size_height}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.chart_type}</Badge></TableCell>
                    <TableCell>
                      <span className="text-sm">{kpiNames.length}</span>
                      {kpiNames.length > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          · {kpiNames.slice(0, 2).join(', ')}{kpiNames.length > 2 ? '…' : ''}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.creator?.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {c.updated_at ? formatDistanceToNow(new Date(c.updated_at), { addSuffix: true }) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c.id)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id, c.name)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ChartFormDialog
        open={openForm}
        onClose={() => setOpenForm(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin-charts'] })}
        chartId={editId}
        nextDisplayOrder={nextDisplayOrder}
      />
    </div>
  );
}
