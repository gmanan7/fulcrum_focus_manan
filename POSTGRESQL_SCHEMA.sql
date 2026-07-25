-- ===========================================
-- FULCRUM FOCUS: PostgreSQL Schema
-- Complete Database Setup
-- ===========================================

-- ============ STEP 1: CREATE ENUMS ============

CREATE TYPE app_role AS ENUM ('super_admin', 'factory_manager', 'department_head', 'team_member', 'shop_floor', 'task_only');
CREATE TYPE kpi_frequency AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE kpi_direction AS ENUM ('higher_is_better', 'lower_is_better', 'target_is_exact');
CREATE TYPE kpi_type AS ENUM ('numeric', 'descriptive', 'project_tracker');
CREATE TYPE rag_status AS ENUM ('red', 'amber', 'green');
CREATE TYPE meeting_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'excused');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE task_status AS ENUM ('open', 'in_progress', 'blocked', 'completed', 'cancelled');
CREATE TYPE task_origin AS ENUM ('meeting', 'kpi_red', 'standalone');
CREATE TYPE project_item_status AS ENUM ('active', 'completed', 'on_hold', 'dropped');
CREATE TYPE audit_action AS ENUM ('INSERT', 'UPDATE', 'DELETE');
CREATE TYPE mtd_aggregation_type AS ENUM ('sum', 'average', 'weighted_average');
CREATE TYPE pd_stage AS ENUM ('upcoming','in_process','processing_finished','feedback_approved','feedback_rejected','abandoned');

-- ============ STEP 2: CREATE CORE TABLES ============

CREATE TABLE factory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE department (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factory(id),
  name text NOT NULL,
  code text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(factory_id, code)
);

CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  employee_id text UNIQUE,
  designation text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE TABLE user_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES department(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, department_id)
);

-- ============ STEP 3: KPI TABLES ============

CREATE TABLE kpi_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES department(id),
  name text NOT NULL,
  unit text,
  kpi_type kpi_type NOT NULL DEFAULT 'numeric',
  frequency kpi_frequency NOT NULL DEFAULT 'daily',
  direction kpi_direction NOT NULL DEFAULT 'higher_is_better',
  target_value numeric,
  green_threshold numeric,
  amber_threshold numeric,
  mtd_aggregation mtd_aggregation_type NOT NULL DEFAULT 'sum',
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE kpi_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES kpi_master(id),
  reporting_date date NOT NULL,
  actual_value numeric,
  text_value text,
  computed_status rag_status,
  meeting_id uuid,
  submitted_by uuid NOT NULL REFERENCES profiles(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  is_late_entry boolean NOT NULL DEFAULT false,
  remarks text,
  UNIQUE(kpi_id, reporting_date)
);

CREATE TABLE kpi_charts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kpi_id uuid NOT NULL REFERENCES kpi_master(id),
  department_id uuid REFERENCES department(id) ON DELETE SET NULL,
  chart_type text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE my_view_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kpi_id uuid NOT NULL REFERENCES kpi_master(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, kpi_id)
);

-- ============ STEP 4: PROJECT TRACKER TABLES ============

CREATE TABLE project_tracker_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES kpi_master(id),
  department_id uuid NOT NULL REFERENCES department(id),
  title text NOT NULL,
  description text,
  status project_item_status NOT NULL DEFAULT 'active',
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

CREATE TABLE project_item_stage_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES project_tracker_items(id) ON DELETE CASCADE,
  stage_name text NOT NULL,
  update_note text,
  reporting_date date NOT NULL DEFAULT CURRENT_DATE,
  updated_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ STEP 5: MEETING TABLES ============

CREATE TABLE meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factory(id),
  title text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_start_time time NOT NULL,
  scheduled_end_time time NOT NULL,
  actual_start timestamptz,
  actual_end timestamptz,
  status meeting_status NOT NULL DEFAULT 'scheduled',
  facilitator_id uuid NOT NULL REFERENCES profiles(id),
  location text,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE kpi_entries ADD CONSTRAINT fk_kpi_meeting FOREIGN KEY (meeting_id) REFERENCES meetings(id);

CREATE TABLE meeting_invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id),
  user_id uuid REFERENCES profiles(id),
  guest_name text,
  guest_designation text,
  department_id uuid REFERENCES department(id),
  is_mandatory boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL)
);

CREATE TABLE meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id),
  invitee_id uuid NOT NULL REFERENCES meeting_invitees(id),
  status attendance_status NOT NULL,
  marked_by uuid NOT NULL REFERENCES profiles(id),
  marked_at timestamptz NOT NULL DEFAULT now(),
  remarks text,
  UNIQUE(meeting_id, invitee_id)
);

CREATE TABLE meeting_discussion_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id),
  title text NOT NULL,
  notes text,
  sequence int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

CREATE TABLE meeting_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meetings(id),
  discussion_point_id uuid REFERENCES meeting_discussion_points(id),
  decision_text text NOT NULL,
  linked_task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

CREATE TABLE meeting_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  factory_id uuid REFERENCES factory(id),
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE meeting_template_invitees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES meeting_templates(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES department(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ STEP 6: TASK TABLES ============

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_number serial NOT NULL,
  title text NOT NULL,
  description text,
  department_id uuid NOT NULL REFERENCES department(id),
  owner_id uuid NOT NULL REFERENCES profiles(id),
  assigned_by uuid NOT NULL REFERENCES profiles(id),
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'open',
  due_date date NOT NULL,
  completed_at timestamptz,
  resolution_note text,
  origin_type task_origin NOT NULL DEFAULT 'standalone',
  origin_meeting_id uuid REFERENCES meetings(id),
  origin_kpi_entry_id uuid REFERENCES kpi_entries(id),
  is_carryover boolean NOT NULL DEFAULT false,
  is_private boolean NOT NULL DEFAULT false,
  task_group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);

ALTER TABLE meeting_decisions ADD CONSTRAINT fk_decision_task FOREIGN KEY (linked_task_id) REFERENCES tasks(id);

CREATE TABLE task_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id),
  previous_status task_status,
  new_status task_status NOT NULL,
  update_note text,
  updated_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_due_date_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id),
  previous_due_date date NOT NULL,
  new_due_date date NOT NULL,
  reason text NOT NULL,
  changed_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (LENGTH(TRIM(name)) > 0),
  created_by uuid NOT NULL REFERENCES profiles(id),
  factory_id uuid NOT NULL REFERENCES factory(id),
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE task_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES task_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  added_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE tasks ADD CONSTRAINT fk_task_group FOREIGN KEY (task_group_id) REFERENCES task_groups(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_task_group_id ON tasks(task_group_id);
CREATE INDEX idx_tgm_user_id ON task_group_members(user_id);
CREATE INDEX idx_tgm_group_id ON task_group_members(group_id);

-- ============ STEP 7: PLANNER TABLES ============

CREATE TABLE planner_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  title text NOT NULL,
  notes text,
  time_slots_count int DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ STEP 8: PD (PRODUCT DEVELOPMENT) TABLES ============

CREATE TABLE pd_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number int NOT NULL,
  factory_id uuid NOT NULL REFERENCES factory(id),
  title text NOT NULL,
  customer text,
  product text,
  substrate text,
  stage pd_stage NOT NULL DEFAULT 'upcoming',
  feedback_note text,
  previous_job_id uuid REFERENCES pd_jobs(id),
  respawn_reason text,
  target_dispatch_date date,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  UNIQUE (factory_id, job_number)
);

CREATE TABLE pd_job_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES pd_jobs(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  body text NOT NULL,
  stage_at_comment pd_stage,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pd_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES pd_jobs(id) ON DELETE CASCADE,
  from_stage pd_stage,
  to_stage pd_stage NOT NULL,
  changed_by uuid REFERENCES profiles(id),
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

-- ============ STEP 9: PM (PREVENTIVE MAINTENANCE) TABLES ============

CREATE TABLE pm_machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factory(id),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pm_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES pm_machines(id) ON DELETE CASCADE,
  frequency_days int NOT NULL,
  last_maintained_date date,
  next_due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pm_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES pm_machines(id) ON DELETE CASCADE,
  maintenance_date date NOT NULL,
  technician_name text,
  status text DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ STEP 10: AUDIT TABLES ============

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id text NOT NULL,
  action audit_action NOT NULL,
  old_values jsonb,
  new_values jsonb,
  performed_by uuid REFERENCES profiles(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);

-- ============ STEP 11: INDEXES ============

CREATE INDEX idx_kpi_master_dept ON kpi_master(department_id);
CREATE INDEX idx_kpi_entries_kpi ON kpi_entries(kpi_id);
CREATE INDEX idx_kpi_entries_date ON kpi_entries(reporting_date);
CREATE INDEX idx_tasks_dept ON tasks(department_id);
CREATE INDEX idx_tasks_owner ON tasks(owner_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due ON tasks(due_date);
CREATE INDEX idx_meetings_factory ON meetings(factory_id);
CREATE INDEX idx_meetings_date ON meetings(scheduled_date);
CREATE INDEX idx_audit_table ON audit_logs(table_name);
CREATE INDEX idx_audit_record ON audit_logs(record_id);
CREATE INDEX idx_pd_jobs_factory ON pd_jobs(factory_id);
CREATE INDEX idx_pm_machines_factory ON pm_machines(factory_id);
CREATE INDEX idx_user_depts_user ON user_departments(user_id);
CREATE INDEX idx_user_depts_dept ON user_departments(department_id);

-- ============ STEP 12: FUNCTIONS ============

-- Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, required_role app_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = p_user_id
    AND user_roles.role = required_role
  );
$$;

-- Helper function: get_user_departments
CREATE OR REPLACE FUNCTION public.get_user_departments(p_user_id uuid)
RETURNS TABLE(department_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ud.department_id FROM user_departments ud WHERE ud.user_id = p_user_id;
$$;

-- Helper function: is_dept_member
CREATE OR REPLACE FUNCTION public.is_dept_member(p_user_id uuid, p_department_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_departments
    WHERE user_id = p_user_id AND department_id = p_department_id
  );
$$;

-- Helper function: is_group_member
CREATE OR REPLACE FUNCTION public.is_group_member(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

-- Helper function: is_group_creator
CREATE OR REPLACE FUNCTION public.is_group_creator(p_user_id uuid, p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM task_groups
    WHERE id = p_group_id AND created_by = p_user_id
  );
$$;

-- Helper function: is_pd_team
CREATE OR REPLACE FUNCTION public.is_pd_team(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(p_user_id, 'super_admin'::app_role)
    OR public.has_role(p_user_id, 'factory_manager'::app_role);
$$;

-- Trigger function: set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger function: audit_trigger
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (table_name, record_id, action, new_values, performed_by)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'INSERT', to_jsonb(NEW), NULL);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, performed_by)
    VALUES (TG_TABLE_NAME, NEW.id::text, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), NULL);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (table_name, record_id, action, old_values, performed_by)
    VALUES (TG_TABLE_NAME, OLD.id::text, 'DELETE', to_jsonb(OLD), NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger function: pd_jobs_assign_number
CREATE OR REPLACE FUNCTION public.pd_jobs_assign_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = 0 THEN
    SELECT COALESCE(MAX(job_number), 0) + 1
      INTO NEW.job_number
      FROM pd_jobs
      WHERE factory_id = NEW.factory_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function: pd_comments_set_stage
CREATE OR REPLACE FUNCTION public.pd_comments_set_stage()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stage_at_comment IS NULL THEN
    SELECT stage INTO NEW.stage_at_comment FROM pd_jobs WHERE id = NEW.job_id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============ STEP 13: TRIGGERS ============

CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_meetings
  AFTER INSERT OR UPDATE OR DELETE ON meetings
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_kpi_entries
  AFTER INSERT OR UPDATE OR DELETE ON kpi_entries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER trg_pd_jobs_assign_number
  BEFORE INSERT ON pd_jobs
  FOR EACH ROW EXECUTE FUNCTION pd_jobs_assign_number();

CREATE TRIGGER trg_pd_jobs_updated_at
  BEFORE UPDATE ON pd_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pd_comments_set_stage
  BEFORE INSERT ON pd_job_comments
  FOR EACH ROW EXECUTE FUNCTION pd_comments_set_stage();

CREATE TRIGGER trg_task_groups_updated_at
  BEFORE UPDATE ON task_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_project_items_updated_at
  BEFORE UPDATE ON project_tracker_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_planner_items_updated_at
  BEFORE UPDATE ON planner_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pm_plan_updated_at
  BEFORE UPDATE ON pm_plan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ STEP 14: SAMPLE DATA (Optional) ============

-- Create a factory
INSERT INTO factory (id, name, code, location) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Main Factory', 'MF-001', 'Location 1');

-- Create a department
INSERT INTO department (id, factory_id, name, code, display_order) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Operations', 'OPS-001', 1);

-- Create a user
INSERT INTO profiles (id, full_name, email, password_hash, employee_id, designation) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', 'Admin User', 'admin@example.com', '$2a$10$...', 'EMP-001', 'Manager');

-- Assign role
INSERT INTO user_roles (user_id, role) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', 'super_admin');

-- Assign to department
INSERT INTO user_departments (user_id, department_id, is_primary) VALUES
  ('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', true);

-- ============ DONE ============
-- Schema created successfully!
