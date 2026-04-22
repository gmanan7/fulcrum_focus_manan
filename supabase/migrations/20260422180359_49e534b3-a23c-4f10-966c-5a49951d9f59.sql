
-- Add columns for activity feed: comments and due-date-change tracking
ALTER TABLE public.task_updates
  ADD COLUMN IF NOT EXISTS update_type text NOT NULL DEFAULT 'status_change',
  ADD COLUMN IF NOT EXISTS previous_due_date date,
  ADD COLUMN IF NOT EXISTS new_due_date date;

-- Allow status fields to be null for non-status updates (comments, due_date_change)
ALTER TABLE public.task_updates ALTER COLUMN new_status DROP NOT NULL;

-- Validate update_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'task_updates_update_type_chk'
  ) THEN
    ALTER TABLE public.task_updates
      ADD CONSTRAINT task_updates_update_type_chk
      CHECK (update_type IN ('status_change', 'comment', 'due_date_change'));
  END IF;
END $$;
