ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "tasks_read" ON public.tasks;

CREATE POLICY "tasks_read" ON public.tasks
FOR SELECT USING (
  (is_private = false AND auth.role() = 'authenticated')
  OR
  (is_private = true AND (
    assigned_by = auth.uid()
    OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'factory_manager'::app_role)
  ))
);