CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (performed_by = auth.uid());