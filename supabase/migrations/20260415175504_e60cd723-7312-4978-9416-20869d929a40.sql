
CREATE TABLE public.my_view_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES public.kpi_master(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, kpi_id)
);

ALTER TABLE public.my_view_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "my_view_own_only"
  ON public.my_view_items
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
