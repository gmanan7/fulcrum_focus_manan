-- Sub-team / task group master
CREATE TABLE public.task_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  factory_id uuid NOT NULL REFERENCES public.factory(id),
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.task_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.task_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_group_id uuid REFERENCES public.task_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_task_group_id ON public.tasks(task_group_id);
CREATE INDEX IF NOT EXISTS idx_tgm_user_id ON public.task_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tgm_group_id ON public.task_group_members(group_id);

-- Security definer helper to avoid recursive RLS on task_group_members
CREATE OR REPLACE FUNCTION public.is_group_member(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_group_creator(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_groups
    WHERE id = p_group_id AND created_by = p_user_id
  );
$$;

-- RLS for task_groups
ALTER TABLE public.task_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_groups_read" ON public.task_groups
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'factory_manager') OR
    created_by = auth.uid() OR
    public.is_group_member(auth.uid(), id)
  );

CREATE POLICY "task_groups_insert" ON public.task_groups
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated' AND created_by = auth.uid()
  );

CREATE POLICY "task_groups_update" ON public.task_groups
  FOR UPDATE USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'))
  WITH CHECK (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY "task_groups_delete" ON public.task_groups
  FOR DELETE USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin'));

-- RLS for task_group_members
ALTER TABLE public.task_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tgm_read" ON public.task_group_members
  FOR SELECT USING (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'factory_manager') OR
    user_id = auth.uid() OR
    public.is_group_member(auth.uid(), group_id) OR
    public.is_group_creator(auth.uid(), group_id)
  );

CREATE POLICY "tgm_insert" ON public.task_group_members
  FOR INSERT WITH CHECK (
    public.is_group_creator(auth.uid(), group_id) OR
    has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "tgm_delete" ON public.task_group_members
  FOR DELETE USING (
    public.is_group_creator(auth.uid(), group_id) OR
    has_role(auth.uid(), 'super_admin') OR
    user_id = auth.uid()  -- allow leave group
  );

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_groups_updated_at
BEFORE UPDATE ON public.task_groups
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Updated tasks_read policy to handle group-scoped tasks
DROP POLICY IF EXISTS "tasks_read" ON public.tasks;

CREATE POLICY "tasks_read" ON public.tasks
FOR SELECT USING (
  (is_private = false AND task_group_id IS NULL AND auth.role() = 'authenticated')
  OR
  (is_private = true AND (
    assigned_by = auth.uid() OR owner_id = auth.uid() OR
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'factory_manager')
  ))
  OR
  (task_group_id IS NOT NULL AND (
    has_role(auth.uid(), 'super_admin') OR
    has_role(auth.uid(), 'factory_manager') OR
    public.is_group_member(auth.uid(), task_group_id)
  ))
);