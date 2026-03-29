
-- FIX 1: Restrict profiles_read to authenticated users only
DROP POLICY IF EXISTS profiles_read ON profiles;
CREATE POLICY profiles_read ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.role() = 'authenticated');

-- FIX 2: Restrict tasks_write to task owner, assignee, or admins/managers
DROP POLICY IF EXISTS tasks_write ON tasks;
CREATE POLICY tasks_write ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY tasks_update ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR assigned_by = auth.uid()
    OR created_by = auth.uid()
    OR has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'factory_manager')
  );

CREATE POLICY tasks_delete ON tasks
  FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin')
    OR has_role(auth.uid(), 'factory_manager')
  );

-- FIX 3: Restrict audit_insert so performed_by must match the caller
DROP POLICY IF EXISTS audit_insert ON audit_logs;
CREATE POLICY audit_insert ON audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (performed_by = auth.uid());
