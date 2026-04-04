
CREATE TABLE public.planner_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  display_order int NOT NULL DEFAULT 0,
  recurrence_type text DEFAULT 'none' CHECK (recurrence_type IN ('none','daily','weekly','monthly')),
  recurrence_day_of_week int,
  recurrence_day_of_month int,
  origin_context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.planner_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planner_own_only" ON public.planner_items
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
