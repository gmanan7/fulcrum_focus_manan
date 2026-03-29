
-- ENUMS
CREATE TYPE app_role AS ENUM ('super_admin', 'factory_manager', 'department_head', 'team_member');
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

-- TABLES
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
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
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

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action audit_action NOT NULL,
  old_values jsonb,
  new_values jsonb,
  performed_by uuid REFERENCES profiles(id),
  performed_at timestamptz NOT NULL DEFAULT now()
);

-- SECURITY FUNCTIONS
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

CREATE OR REPLACE FUNCTION public.get_user_departments(p_user_id uuid)
RETURNS TABLE(department_id uuid)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT ud.department_id FROM user_departments ud WHERE ud.user_id = p_user_id;
$$;

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

-- RLS POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_admin_insert" ON profiles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_read" ON user_roles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "user_roles_admin_all" ON user_roles FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE factory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "factory_read" ON factory FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "factory_admin_all" ON factory FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE department ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dept_read" ON department FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "dept_admin_all" ON department FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE user_departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_depts_read" ON user_departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "user_depts_admin_all" ON user_departments FOR ALL USING (public.has_role(auth.uid(), 'super_admin'));

ALTER TABLE kpi_master ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_master_read" ON kpi_master FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "kpi_master_write" ON kpi_master FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'factory_manager')
);

ALTER TABLE kpi_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_entries_read" ON kpi_entries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "kpi_entries_write" ON kpi_entries FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE project_tracker_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proj_items_read" ON project_tracker_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "proj_items_write" ON project_tracker_items FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE project_item_stage_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proj_stage_all" ON project_item_stage_updates FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_read" ON meetings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "meetings_write" ON meetings FOR ALL USING (
  public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'factory_manager')
);

ALTER TABLE meeting_invitees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitees_all" ON meeting_invitees FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE meeting_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_all" ON meeting_attendance FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE meeting_discussion_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "disc_points_all" ON meeting_discussion_points FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE meeting_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decisions_all" ON meeting_decisions FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_read" ON tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tasks_write" ON tasks FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE task_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_updates_all" ON task_updates FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE task_due_date_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "due_date_hist_all" ON task_due_date_history FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read_admin" ON audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY "audit_insert" ON audit_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- SEED DATA
INSERT INTO factory (name, code, location) VALUES ('ITC PPB Unit', 'ITC-PPB', 'Nadiad, Gujarat');

INSERT INTO department (factory_id, name, code, display_order) VALUES
  ((SELECT id FROM factory WHERE code='ITC-PPB'), 'EHS', 'EHS', 1),
  ((SELECT id FROM factory WHERE code='ITC-PPB'), 'Quality', 'QA', 2),
  ((SELECT id FROM factory WHERE code='ITC-PPB'), 'Production', 'PROD', 3),
  ((SELECT id FROM factory WHERE code='ITC-PPB'), 'Engineering', 'ENG', 4),
  ((SELECT id FROM factory WHERE code='ITC-PPB'), 'Human Resources', 'HR', 5),
  ((SELECT id FROM factory WHERE code='ITC-PPB'), 'Stores', 'STORES', 6),
  ((SELECT id FROM factory WHERE code='ITC-PPB'), 'Finance', 'FIN', 7),
  ((SELECT id FROM factory WHERE code='ITC-PPB'), 'Logistics & Dispatch', 'LOG', 8),
  ((SELECT id FROM factory WHERE code='ITC-PPB'), 'Product Development', 'PD', 9);
