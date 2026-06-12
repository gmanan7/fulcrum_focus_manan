import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import {
  CHART_COLOR_PRESETS,
  emptyChartForm,
  validateChartForm,
  type ChartFormState,
  type ChartKpiRow,
  type ChartType,
  type RenderAs,
  type Axis,
} from '@/lib/chartAdmin';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  chartId?: string | null;
  nextDisplayOrder: number;
}

export function ChartFormDialog({ open, onClose, onSaved, chartId, nextDisplayOrder }: Props) {
  const isEdit = !!chartId;
  const [form, setForm] = useState<ChartFormState>(emptyChartForm(nextDisplayOrder));
  const [saving, setSaving] = useState(false);

  const { data: kpis } = useQuery({
    queryKey: ['chart-form-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_master')
        .select('id, name, department:department_id(name)')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['chart-form-departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('department')
        .select('id, name')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });


  // Load existing chart when editing
  useEffect(() => {
    if (!open) return;
    if (!chartId) {
      setForm(emptyChartForm(nextDisplayOrder));
      return;
    }
    (async () => {
      const { data: chart } = await supabase
        .from('kpi_charts')
        .select('*')
        .eq('id', chartId)
        .maybeSingle();
      const { data: links } = await supabase
        .from('kpi_chart_kpis')
        .select('*')
        .eq('chart_id', chartId)
        .order('display_order');
      if (chart) {
        setForm({
          name: chart.name,
          size_width: chart.size_width as 1 | 2 | 3,
          size_height: chart.size_height as 1 | 2 | 3,
          chart_type: chart.chart_type as ChartType,
          display_order: chart.display_order,
          department_id: (chart as any).department_id ?? null,
          kpis: (links || []).map((l: any) => ({
            kpi_id: l.kpi_id,
            render_as: l.render_as,
            axis: l.axis,
            color: l.color,
            display_order: l.display_order,
          })),
        });
      }
    })();
  }, [open, chartId, nextDisplayOrder]);

  const usedIds = useMemo(() => new Set(form.kpis.map((k) => k.kpi_id).filter(Boolean)), [form.kpis]);

  const updateKpi = (i: number, patch: Partial<ChartKpiRow>) => {
    setForm((f) => ({ ...f, kpis: f.kpis.map((k, idx) => (idx === i ? { ...k, ...patch } : k)) }));
  };

  const addKpi = () => {
    setForm((f) => ({
      ...f,
      kpis: [...f.kpis, { kpi_id: '', render_as: 'line', axis: 'primary', color: null, display_order: f.kpis.length }],
    }));
  };

  const removeKpi = (i: number) => {
    setForm((f) => ({ ...f, kpis: f.kpis.filter((_, idx) => idx !== i).map((k, idx) => ({ ...k, display_order: idx })) }));
  };

  const moveKpi = (i: number, dir: -1 | 1) => {
    setForm((f) => {
      const next = [...f.kpis];
      const j = i + dir;
      if (j < 0 || j >= next.length) return f;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...f, kpis: next.map((k, idx) => ({ ...k, display_order: idx })) };
    });
  };

  const handleSave = async () => {
    const v = validateChartForm(form);
    if (!v.ok) {
      toast({ title: 'Cannot save', description: v.error, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let id = chartId;
      const chartPayload = {
        name: form.name.trim(),
        size_width: form.size_width,
        size_height: form.size_height,
        chart_type: form.chart_type,
        display_order: form.display_order,
        department_id: form.department_id,
      };
      if (isEdit && id) {
        const { error } = await supabase.from('kpi_charts').update(chartPayload).eq('id', id);
        if (error) throw error;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('kpi_charts')
          .insert({ ...chartPayload, created_by: user?.id })
          .select('id')
          .single();
        if (error) throw error;
        id = data.id;
      }
      // Replace KPI rows
      const { error: delErr } = await supabase.from('kpi_chart_kpis').delete().eq('chart_id', id!);
      if (delErr) throw delErr;
      if (form.kpis.length > 0) {
        const rows = form.kpis.map((k, idx) => ({
          chart_id: id!,
          kpi_id: k.kpi_id,
          render_as: k.render_as,
          axis: k.axis,
          color: k.color,
          display_order: idx,
        }));
        const { error: insErr } = await supabase.from('kpi_chart_kpis').insert(rows);
        if (insErr) throw insErr;
      }
      toast({ title: isEdit ? 'Chart updated' : 'Chart created' });
      onSaved();
      onClose();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Chart' : 'New Chart'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-10" />
          </div>

          <div className="space-y-2">
            <Label>Department *</Label>
            <Select
              value={form.department_id ?? ''}
              onValueChange={(v) => setForm((f) => ({ ...f, department_id: v }))}
            >
              <SelectTrigger className="h-10"><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {(departments || []).map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Chart will appear in this department's section on KPI Trends.</p>
          </div>


          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Width</Label>
              <RadioGroup
                value={String(form.size_width)}
                onValueChange={(v) => setForm((f) => ({ ...f, size_width: Number(v) as 1 | 2 | 3 }))}
                className="flex gap-2"
              >
                {[1, 2, 3].map((n) => (
                  <label key={n} className="flex items-center gap-1.5 cursor-pointer">
                    <RadioGroupItem value={String(n)} /><span className="text-sm">{n}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Height</Label>
              <RadioGroup
                value={String(form.size_height)}
                onValueChange={(v) => setForm((f) => ({ ...f, size_height: Number(v) as 1 | 2 | 3 }))}
                className="flex gap-2"
              >
                {[1, 2, 3].map((n) => (
                  <label key={n} className="flex items-center gap-1.5 cursor-pointer">
                    <RadioGroupItem value={String(n)} /><span className="text-sm">{n}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input
                type="number"
                value={form.display_order}
                onChange={(e) => setForm((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Chart Type</Label>
            <RadioGroup
              value={form.chart_type}
              onValueChange={(v) => setForm((f) => ({ ...f, chart_type: v as ChartType }))}
              className="flex gap-4"
            >
              {(['line', 'bar', 'composed'] as ChartType[]).map((t) => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer capitalize">
                  <RadioGroupItem value={t} /><span className="text-sm">{t}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>KPIs *</Label>
              <Button type="button" variant="outline" size="sm" onClick={addKpi} className="gap-1">
                <Plus className="h-3.5 w-3.5" /> Add KPI
              </Button>
            </div>
            {form.kpis.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">No KPIs added. Click "Add KPI" to begin.</p>
            )}
            {form.kpis.map((row, i) => {
              const availableKpis = (kpis || []).filter(
                (k: any) => k.id === row.kpi_id || !usedIds.has(k.id)
              );
              return (
                <div key={i} className="rounded-md border p-3 space-y-2 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <button type="button" disabled={i === 0} onClick={() => moveKpi(i, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button type="button" disabled={i === form.kpis.length - 1} onClick={() => moveKpi(i, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                    <Select value={row.kpi_id} onValueChange={(v) => updateKpi(i, { kpi_id: v })}>
                      <SelectTrigger className="h-9 flex-1"><SelectValue placeholder="Select KPI" /></SelectTrigger>
                      <SelectContent>
                        {availableKpis.map((k: any) => (
                          <SelectItem key={k.id} value={k.id}>
                            {k.name} <span className="text-muted-foreground text-xs">· {k.department?.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeKpi(i)} className="h-9 w-9 text-destructive shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Render As</Label>
                      <Select value={row.render_as} onValueChange={(v) => updateKpi(i, { render_as: v as RenderAs })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="line">Line</SelectItem>
                          <SelectItem value="bar">Bar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Axis</Label>
                      <Select value={row.axis} onValueChange={(v) => updateKpi(i, { axis: v as Axis })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="primary">Primary</SelectItem>
                          <SelectItem value="secondary">Secondary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1 pl-6">
                    <Label className="text-xs">Colour</Label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateKpi(i, { color: null })}
                        className={cn(
                          'h-6 px-2 text-xs rounded border',
                          row.color === null ? 'border-foreground bg-background' : 'border-border text-muted-foreground'
                        )}
                      >
                        Auto
                      </button>
                      {CHART_COLOR_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateKpi(i, { color: c })}
                          className={cn(
                            'h-6 w-6 rounded border-2 transition',
                            row.color === c ? 'border-foreground scale-110' : 'border-transparent'
                          )}
                          style={{ background: c }}
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !validateChartForm(form).ok}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Chart'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
