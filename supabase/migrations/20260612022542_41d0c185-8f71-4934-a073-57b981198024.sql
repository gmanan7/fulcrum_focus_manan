
-- 1. Enum
CREATE TYPE public.pd_stage AS ENUM (
  'upcoming','in_process','processing_finished',
  'feedback_approved','feedback_rejected','abandoned'
);

-- 2. pd_jobs
CREATE TABLE public.pd_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number int NOT NULL,
  factory_id uuid NOT NULL REFERENCES public.factory(id),
  title text NOT NULL,
  customer text,
  product text,
  substrate text,
  stage public.pd_stage NOT NULL DEFAULT 'upcoming',
  feedback_note text,
  previous_job_id uuid REFERENCES public.pd_jobs(id),
  respawn_reason text,
  target_dispatch_date date,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (factory_id, job_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pd_jobs TO authenticated;
GRANT ALL ON public.pd_jobs TO service_role;

-- 3. pd_job_comments
CREATE TABLE public.pd_job_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.pd_jobs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id),
  body text NOT NULL,
  stage_at_comment public.pd_stage,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pd_job_comments TO authenticated;
GRANT ALL ON public.pd_job_comments TO service_role;

-- 4. pd_stage_history
CREATE TABLE public.pd_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.pd_jobs(id) ON DELETE CASCADE,
  from_stage public.pd_stage,
  to_stage public.pd_stage NOT NULL,
  changed_by uuid REFERENCES public.profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

GRANT SELECT ON public.pd_stage_history TO authenticated;
GRANT ALL ON public.pd_stage_history TO service_role;

-- 5. is_pd_team helper
CREATE OR REPLACE FUNCTION public.is_pd_team(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(p_user_id, 'super_admin'::app_role)
    OR public.has_role(p_user_id, 'factory_manager'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_departments
      WHERE user_id = p_user_id
        AND department_id = '5011afbf-efed-4494-85ca-5aa455453441'::uuid
    );
$$;

-- 6. Enable RLS
ALTER TABLE public.pd_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pd_job_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pd_stage_history ENABLE ROW LEVEL SECURITY;

-- pd_jobs policies
CREATE POLICY "pd_jobs read all auth" ON public.pd_jobs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pd_jobs insert pd team" ON public.pd_jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_pd_team(auth.uid()));

CREATE POLICY "pd_jobs update pd team" ON public.pd_jobs
  FOR UPDATE TO authenticated
  USING (public.is_pd_team(auth.uid()))
  WITH CHECK (public.is_pd_team(auth.uid()));

CREATE POLICY "pd_jobs delete admin wm" ON public.pd_jobs
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role)
    OR public.has_role(auth.uid(), 'factory_manager'::app_role)
  );

-- pd_job_comments policies
CREATE POLICY "pd_comments read all auth" ON public.pd_job_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pd_comments insert self" ON public.pd_job_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "pd_comments update author or admin" ON public.pd_job_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "pd_comments delete author or admin" ON public.pd_job_comments
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin'::app_role));

-- pd_stage_history policies (read-only via API; writes via SECURITY DEFINER RPCs)
CREATE POLICY "pd_stage_history read all auth" ON public.pd_stage_history
  FOR SELECT TO authenticated USING (true);

-- 7. Auto-assign job_number per factory
CREATE OR REPLACE FUNCTION public.pd_jobs_assign_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = 0 THEN
    SELECT COALESCE(MAX(job_number), 0) + 1
      INTO NEW.job_number
      FROM public.pd_jobs
      WHERE factory_id = NEW.factory_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pd_jobs_assign_number
  BEFORE INSERT ON public.pd_jobs
  FOR EACH ROW EXECUTE FUNCTION public.pd_jobs_assign_number();

-- 8. updated_at
CREATE TRIGGER trg_pd_jobs_updated_at
  BEFORE UPDATE ON public.pd_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 9. Auto stage_at_comment on comments
CREATE OR REPLACE FUNCTION public.pd_comments_set_stage()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stage_at_comment IS NULL THEN
    SELECT stage INTO NEW.stage_at_comment FROM public.pd_jobs WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pd_comments_set_stage
  BEFORE INSERT ON public.pd_job_comments
  FOR EACH ROW EXECUTE FUNCTION public.pd_comments_set_stage();

-- 10. RPC: update_pd_job_stage
CREATE OR REPLACE FUNCTION public.update_pd_job_stage(
  p_job_id uuid,
  p_new_stage public.pd_stage,
  p_note text DEFAULT NULL,
  p_feedback_note text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_current public.pd_stage;
  v_valid boolean := false;
BEGIN
  IF NOT public.is_pd_team(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised to change PD job stage';
  END IF;

  SELECT stage INTO v_current FROM public.pd_jobs WHERE id = p_job_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'PD job not found';
  END IF;

  -- Validate forward transitions
  IF v_current = 'upcoming' AND p_new_stage IN ('in_process','abandoned') THEN v_valid := true;
  ELSIF v_current = 'in_process' AND p_new_stage IN ('processing_finished','abandoned') THEN v_valid := true;
  ELSIF v_current = 'processing_finished' AND p_new_stage IN ('feedback_approved','feedback_rejected','abandoned') THEN v_valid := true;
  END IF;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Invalid stage transition from % to %', v_current, p_new_stage;
  END IF;

  IF p_new_stage IN ('feedback_rejected','abandoned')
     AND (p_feedback_note IS NULL OR length(btrim(p_feedback_note)) = 0) THEN
    RAISE EXCEPTION 'Feedback note is required when moving to % stage', p_new_stage;
  END IF;

  UPDATE public.pd_jobs
     SET stage = p_new_stage,
         feedback_note = COALESCE(p_feedback_note, feedback_note),
         closed_at = CASE
            WHEN p_new_stage IN ('feedback_approved','feedback_rejected','abandoned')
              THEN now() ELSE closed_at END
   WHERE id = p_job_id;

  INSERT INTO public.pd_stage_history (job_id, from_stage, to_stage, changed_by, note)
    VALUES (p_job_id, v_current, p_new_stage, auth.uid(), p_note);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_pd_job_stage(uuid, public.pd_stage, text, text) TO authenticated;

-- 11. RPC: spawn_pd_job_from
CREATE OR REPLACE FUNCTION public.spawn_pd_job_from(
  p_source_job_id uuid,
  p_respawn_reason text,
  p_new_title text,
  p_new_target_dispatch_date date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_src public.pd_jobs;
  v_new_id uuid;
BEGIN
  IF NOT public.is_pd_team(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorised to spawn PD jobs';
  END IF;

  SELECT * INTO v_src FROM public.pd_jobs WHERE id = p_source_job_id;
  IF v_src.id IS NULL THEN
    RAISE EXCEPTION 'Source PD job not found';
  END IF;
  IF v_src.stage NOT IN ('feedback_rejected','abandoned') THEN
    RAISE EXCEPTION 'Can only spawn from a rejected or abandoned job';
  END IF;
  IF p_respawn_reason IS NULL OR length(btrim(p_respawn_reason)) = 0 THEN
    RAISE EXCEPTION 'Respawn reason is required';
  END IF;

  INSERT INTO public.pd_jobs (
    factory_id, title, customer, product, substrate,
    target_dispatch_date, previous_job_id, respawn_reason, created_by
  ) VALUES (
    v_src.factory_id,
    COALESCE(NULLIF(btrim(p_new_title), ''), v_src.title),
    v_src.customer, v_src.product, v_src.substrate,
    p_new_target_dispatch_date,
    v_src.id, p_respawn_reason, auth.uid()
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spawn_pd_job_from(uuid, text, text, date) TO authenticated;
