/**
 * TypeScript interfaces for the PM (Preventive Maintenance) Schedule tables.
 * Mirrors the schema of pm_machines, pm_plan, and pm_actual in DB.
 */

export interface PmMachine {
  id: string;
  factory_id: string;
  line: 'SFM' | 'RFM';
  group_name: string;
  name: string;
  is_critical: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface PmPlan {
  id: string;
  machine_id: string;
  planned_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PmActual {
  id: string;
  machine_id: string;
  actual_date: string;
  remarks: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}
