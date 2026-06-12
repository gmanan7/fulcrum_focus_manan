
REVOKE EXECUTE ON FUNCTION public.is_pd_team(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_pd_job_stage(uuid, public.pd_stage, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spawn_pd_job_from(uuid, text, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pd_jobs_assign_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pd_comments_set_stage() FROM PUBLIC, anon;
