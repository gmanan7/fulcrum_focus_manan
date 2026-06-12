
-- kpi_charts
CREATE TABLE public.kpi_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  factory_id uuid REFERENCES public.factory(id) ON DELETE SET NULL,
  size_width int NOT NULL DEFAULT 1 CHECK (size_width BETWEEN 1 AND 3),
  size_height int NOT NULL DEFAULT 1 CHECK (size_height BETWEEN 1 AND 3),
  chart_type text NOT NULL DEFAULT 'composed' CHECK (chart_type IN ('line','bar','composed')),
  display_order int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_charts TO authenticated;
GRANT ALL ON public.kpi_charts TO service_role;
ALTER TABLE public.kpi_charts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_charts read for authenticated" ON public.kpi_charts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi_charts write admin/WM" ON public.kpi_charts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'factory_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'factory_manager'::app_role));

CREATE TRIGGER set_kpi_charts_updated_at BEFORE UPDATE ON public.kpi_charts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- kpi_chart_kpis
CREATE TABLE public.kpi_chart_kpis (
  chart_id uuid NOT NULL REFERENCES public.kpi_charts(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES public.kpi_master(id) ON DELETE CASCADE,
  render_as text NOT NULL DEFAULT 'line' CHECK (render_as IN ('line','bar')),
  axis text NOT NULL DEFAULT 'primary' CHECK (axis IN ('primary','secondary')),
  color text,
  display_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (chart_id, kpi_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_chart_kpis TO authenticated;
GRANT ALL ON public.kpi_chart_kpis TO service_role;
ALTER TABLE public.kpi_chart_kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_chart_kpis read for authenticated" ON public.kpi_chart_kpis
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "kpi_chart_kpis write admin/WM" ON public.kpi_chart_kpis
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'factory_manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role) OR public.has_role(auth.uid(), 'factory_manager'::app_role));

-- kpi_master: is_hidden_from_trends
ALTER TABLE public.kpi_master
  ADD COLUMN IF NOT EXISTS is_hidden_from_trends boolean NOT NULL DEFAULT false;
