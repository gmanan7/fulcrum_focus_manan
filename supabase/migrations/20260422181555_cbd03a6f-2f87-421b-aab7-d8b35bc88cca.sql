-- Extend task_updates for full activity logging
-- Applied directly: 22 Apr 2026 (idempotent re-application)

ALTER TABLE public.task_updates 
DROP CONSTRAINT IF EXISTS task_updates_update_type_check;

ALTER TABLE public.task_updates
ADD CONSTRAINT task_updates_update_type_check 
CHECK (update_type IN (
  'status_change',
  'comment',
  'due_date_change', 
  'title_change',
  'description_change',
  'assignee_change'
));

ALTER TABLE public.task_updates 
ADD COLUMN IF NOT EXISTS previous_text text,
ADD COLUMN IF NOT EXISTS new_text text;

ALTER TABLE public.task_updates 
ALTER COLUMN new_status DROP NOT NULL;