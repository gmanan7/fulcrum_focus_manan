export type AppRole = 'super_admin' | 'factory_manager' | 'department_head' | 'team_member' | 'shop_floor' | 'task_only';
export type KpiFrequency = 'daily' | 'weekly' | 'monthly';
export type KpiDirection = 'higher_is_better' | 'lower_is_better' | 'target_is_exact';
export type KpiType = 'numeric' | 'descriptive' | 'project_tracker';
export type RagStatus = 'red' | 'amber' | 'green';
export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'excused';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type TaskOrigin = 'meeting' | 'kpi_red' | 'standalone';
export type ProjectItemStatus = 'active' | 'completed' | 'on_hold' | 'dropped';
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';
export type MtdAggregationType = 'sum' | 'average' | 'weighted_average';
export type PdStage = 'upcoming' | 'in_process' | 'processing_finished' | 'feedback_approved' | 'feedback_rejected' | 'abandoned';

export interface Factory {
  id: string;
  name: string;
  code: string;
  location?: string;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  factory_id: string;
  name: string;
  code: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  employee_id?: string;
  designation?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  roles?: AppRole[];
  departments?: Department[];
}

export interface KpiMaster {
  id: string;
  department_id: string;
  name: string;
  unit?: string;
  kpi_type: KpiType;
  frequency: KpiFrequency;
  direction: KpiDirection;
  target_value?: number;
  green_threshold?: number;
  amber_threshold?: number;
  mtd_aggregation: MtdAggregationType;
  display_order: number;
  is_active: boolean;
  description?: string;
  created_at: string;
}

export interface KpiEntry {
  id: string;
  kpi_id: string;
  reporting_date: string;
  actual_value?: number;
  text_value?: string;
  computed_status?: RagStatus;
  meeting_id?: string;
  notes?: string;
  entered_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  department_id: string;
  assignee_id?: string;
  creator_id?: string;
  due_date?: string;
  priority: TaskPriority;
  status: TaskStatus;
  origin: TaskOrigin;
  meeting_id?: string;
  kpi_id?: string;
  task_group_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskGroup {
  id: string;
  department_id: string;
  name: string;
  description?: string;
  display_order: number;
  created_at: string;
}

export interface Meeting {
  id: string;
  department_id: string;
  title: string;
  meeting_date: string;
  status: MeetingStatus;
  summary?: string;
  created_by?: string;
  created_at: string;
}

export interface MeetingDecision {
  id: string;
  meeting_id: string;
  decision_text: string;
  created_at: string;
}

export interface Project {
  id: string;
  department_id: string;
  name: string;
  code?: string;
  description?: string;
  owner_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface ProjectItem {
  id: string;
  project_id: string;
  title: string;
  status: ProjectItemStatus;
  target_date?: string;
  created_at: string;
}

export interface PdJob {
  id: string;
  department_id: string;
  job_number: string;
  title: string;
  stage: PdStage;
  current_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PmMachine {
  id: string;
  department_id: string;
  machine_code: string;
  name: string;
  location?: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_data?: any;
  new_data?: any;
  performed_by?: string;
  created_at: string;
}
