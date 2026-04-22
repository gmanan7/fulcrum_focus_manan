-- Table 1: pm_machines
CREATE TABLE public.pm_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES public.factory(id),
  line text NOT NULL,
  group_name text NOT NULL,
  name text NOT NULL,
  is_critical boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_machines_read" ON public.pm_machines
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pm_machines_write" ON public.pm_machines
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'factory_manager')
  );

-- Table 2: pm_plan
CREATE TABLE public.pm_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.pm_machines(id) ON DELETE CASCADE,
  planned_date date NOT NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(machine_id, planned_date)
);

ALTER TABLE public.pm_plan ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_plan_read" ON public.pm_plan
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pm_plan_write" ON public.pm_plan
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'factory_manager') OR
    has_role(auth.uid(), 'department_head')
  );

-- Table 3: pm_actual
CREATE TABLE public.pm_actual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.pm_machines(id) ON DELETE CASCADE,
  actual_date date NOT NULL,
  remarks text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(machine_id, actual_date)
);

ALTER TABLE public.pm_actual ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pm_actual_read" ON public.pm_actual
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pm_actual_write" ON public.pm_actual
  FOR ALL USING (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'factory_manager') OR
    has_role(auth.uid(), 'department_head') OR
    EXISTS (
      SELECT 1 FROM user_departments ud
      JOIN department d ON d.id = ud.department_id
      WHERE ud.user_id = auth.uid() AND d.code = 'ENG'
    )
  );

-- Seed data
INSERT INTO public.pm_machines
  (factory_id, line, group_name, name, is_critical, display_order)
SELECT f.id, v.line, v.grp, v.mname, v.critical, v.ord
FROM public.factory f
CROSS JOIN (VALUES
  ('SFM','Printing',  'Heidelberg - 1',       true,  1),
  ('SFM','Printing',  'Heidelberg - 2',       true,  2),
  ('SFM','C&C',       'Nova Cut E',           true,  3),
  ('SFM','C&C',       'Novacut ER-1',         true,  4),
  ('SFM','C&C',       'Novacut ER-2',         true,  5),
  ('SFM','VA',        'Hot Foil Stamping',    true,  6),
  ('SFM','VA',        'Steinemann',           true,  7),
  ('SFM','VA',        'UV Coater',            true,  8),
  ('SFM','VA',        'Meiguang',             true,  9),
  ('SFM','VA',        'Sheet Fed Gravure',    true,  10),
  ('SFM','VA',        'Kohmann Liner',        true,  11),
  ('SFM','VA',        'Clamshell 1/2',        true,  12),
  ('SFM','VA',        'Zhengmao Machine',     true,  13),
  ('SFM','F&G',       'Exper Fold',           true,  14),
  ('SFM','F&G',       'Vision Fold-1',        true,  15),
  ('SFM','F&G',       'Vision Fold-2',        true,  16),
  ('SFM','F&G',       'Nova Fold',            true,  17),
  ('SFM','Pre-Press', 'CTP',                  true,  18),
  ('SFM','Pre-Press', 'Kongsberg',            false, 19),
  ('SFM','Others',    'Pile Turner',          false, 20),
  ('RFM','RFM Line',  'Delta Printing Line',  true,  21),
  ('RFM','RFM Line',  'Hugobeck',             true,  22),
  ('RFM','RFM Line',  'Hunkeler',             true,  23),
  ('RFM','RFM Line',  'Bundler Line',         true,  24)
) AS v(line, grp, mname, critical, ord)
WHERE f.code = 'ITC-PPB';