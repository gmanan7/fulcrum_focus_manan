
-- FIX kpi_entries: enforce submitted_by = auth.uid() and department membership
DROP POLICY IF EXISTS kpi_entries_write ON kpi_entries;

CREATE POLICY kpi_entries_insert ON kpi_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND (
      has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager')
      OR EXISTS (
        SELECT 1 FROM kpi_master km
        JOIN user_departments ud ON ud.department_id = km.department_id
        WHERE km.id = kpi_id AND ud.user_id = auth.uid()
      )
    )
  );

CREATE POLICY kpi_entries_update ON kpi_entries
  FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid() OR has_role(auth.uid(), 'factory_manager') OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY kpi_entries_delete ON kpi_entries
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

-- FIX project_tracker_items: restrict mutations to dept members or admins
DROP POLICY IF EXISTS proj_items_write ON project_tracker_items;

CREATE POLICY proj_items_insert ON project_tracker_items
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager')
    OR is_dept_member(auth.uid(), department_id)
  );

CREATE POLICY proj_items_update ON project_tracker_items
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager')
    OR created_by = auth.uid()
    OR is_dept_member(auth.uid(), department_id)
  );

CREATE POLICY proj_items_delete ON project_tracker_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

-- FIX project_item_stage_updates: restrict to updater or admins
DROP POLICY IF EXISTS proj_stage_all ON project_item_stage_updates;

CREATE POLICY proj_stage_read ON project_item_stage_updates
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY proj_stage_insert ON project_item_stage_updates
  FOR INSERT TO authenticated
  WITH CHECK (updated_by = auth.uid());

CREATE POLICY proj_stage_update ON project_item_stage_updates
  FOR UPDATE TO authenticated
  USING (updated_by = auth.uid() OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

CREATE POLICY proj_stage_delete ON project_item_stage_updates
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

-- FIX meeting_invitees: only meeting managers can mutate
DROP POLICY IF EXISTS invitees_all ON meeting_invitees;

CREATE POLICY invitees_read ON meeting_invitees
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY invitees_write ON meeting_invitees
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

CREATE POLICY invitees_update ON meeting_invitees
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

CREATE POLICY invitees_delete ON meeting_invitees
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

-- FIX task_updates: restrict to updater or admins
DROP POLICY IF EXISTS task_updates_all ON task_updates;

CREATE POLICY task_updates_read ON task_updates
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY task_updates_insert ON task_updates
  FOR INSERT TO authenticated
  WITH CHECK (updated_by = auth.uid());

CREATE POLICY task_updates_modify ON task_updates
  FOR UPDATE TO authenticated
  USING (updated_by = auth.uid() OR has_role(auth.uid(), 'super_admin'));

CREATE POLICY task_updates_delete ON task_updates
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- FIX task_due_date_history: restrict to changer or admins
DROP POLICY IF EXISTS due_date_hist_all ON task_due_date_history;

CREATE POLICY due_date_hist_read ON task_due_date_history
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY due_date_hist_insert ON task_due_date_history
  FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid());

CREATE POLICY due_date_hist_delete ON task_due_date_history
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'));

-- FIX meeting_attendance: only meeting managers can mutate
DROP POLICY IF EXISTS attendance_all ON meeting_attendance;

CREATE POLICY attendance_read ON meeting_attendance
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY attendance_insert ON meeting_attendance
  FOR INSERT TO authenticated
  WITH CHECK (marked_by = auth.uid());

CREATE POLICY attendance_update ON meeting_attendance
  FOR UPDATE TO authenticated
  USING (marked_by = auth.uid() OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

CREATE POLICY attendance_delete ON meeting_attendance
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

-- FIX meeting_discussion_points: restrict mutations
DROP POLICY IF EXISTS disc_points_all ON meeting_discussion_points;

CREATE POLICY disc_points_read ON meeting_discussion_points
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY disc_points_insert ON meeting_discussion_points
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY disc_points_update ON meeting_discussion_points
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

CREATE POLICY disc_points_delete ON meeting_discussion_points
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

-- FIX meeting_decisions: restrict mutations
DROP POLICY IF EXISTS decisions_all ON meeting_decisions;

CREATE POLICY decisions_read ON meeting_decisions
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY decisions_insert ON meeting_decisions
  FOR INSERT TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY decisions_update ON meeting_decisions
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

CREATE POLICY decisions_delete ON meeting_decisions
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));

-- FIX meeting_template_invitees: only admins/managers can mutate
DROP POLICY IF EXISTS template_invitees_all ON meeting_template_invitees;

CREATE POLICY template_invitees_read ON meeting_template_invitees
  FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

CREATE POLICY template_invitees_write ON meeting_template_invitees
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'factory_manager'));
