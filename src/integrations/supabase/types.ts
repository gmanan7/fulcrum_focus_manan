export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          id: string
          new_values: Json | null
          old_values: Json | null
          performed_at: string
          performed_by: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          performed_at?: string
          performed_by?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          performed_at?: string
          performed_by?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      department: {
        Row: {
          code: string
          created_at: string
          display_order: number
          factory_id: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          display_order?: number
          factory_id: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          display_order?: number
          factory_id?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory"
            referencedColumns: ["id"]
          },
        ]
      }
      factory: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          location: string | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      kpi_chart_kpis: {
        Row: {
          axis: string
          chart_id: string
          color: string | null
          display_order: number
          kpi_id: string
          render_as: string
        }
        Insert: {
          axis?: string
          chart_id: string
          color?: string | null
          display_order?: number
          kpi_id: string
          render_as?: string
        }
        Update: {
          axis?: string
          chart_id?: string
          color?: string | null
          display_order?: number
          kpi_id?: string
          render_as?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_chart_kpis_chart_id_fkey"
            columns: ["chart_id"]
            isOneToOne: false
            referencedRelation: "kpi_charts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_chart_kpis_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_master"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_charts: {
        Row: {
          chart_type: string
          created_at: string
          created_by: string | null
          department_id: string | null
          display_order: number
          factory_id: string | null
          id: string
          name: string
          size_height: number
          size_width: number
          updated_at: string
        }
        Insert: {
          chart_type?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          display_order?: number
          factory_id?: string | null
          id?: string
          name: string
          size_height?: number
          size_width?: number
          updated_at?: string
        }
        Update: {
          chart_type?: string
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          display_order?: number
          factory_id?: string | null
          id?: string
          name?: string
          size_height?: number
          size_width?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_charts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_charts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_charts_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_entries: {
        Row: {
          actual_value: number | null
          computed_status: Database["public"]["Enums"]["rag_status"] | null
          id: string
          is_late_entry: boolean
          kpi_id: string
          meeting_id: string | null
          remarks: string | null
          reporting_date: string
          submitted_at: string
          submitted_by: string
          text_value: string | null
        }
        Insert: {
          actual_value?: number | null
          computed_status?: Database["public"]["Enums"]["rag_status"] | null
          id?: string
          is_late_entry?: boolean
          kpi_id: string
          meeting_id?: string | null
          remarks?: string | null
          reporting_date: string
          submitted_at?: string
          submitted_by: string
          text_value?: string | null
        }
        Update: {
          actual_value?: number | null
          computed_status?: Database["public"]["Enums"]["rag_status"] | null
          id?: string
          is_late_entry?: boolean
          kpi_id?: string
          meeting_id?: string | null
          remarks?: string | null
          reporting_date?: string
          submitted_at?: string
          submitted_by?: string
          text_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_kpi_meeting"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_entries_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_master: {
        Row: {
          amber_threshold: number | null
          created_at: string
          department_id: string
          description: string | null
          direction: Database["public"]["Enums"]["kpi_direction"]
          display_order: number
          frequency: Database["public"]["Enums"]["kpi_frequency"]
          green_threshold: number | null
          id: string
          is_active: boolean
          is_hidden_from_trends: boolean
          kpi_type: Database["public"]["Enums"]["kpi_type"]
          mtd_aggregation: Database["public"]["Enums"]["mtd_aggregation_type"]
          name: string
          target_value: number | null
          unit: string | null
        }
        Insert: {
          amber_threshold?: number | null
          created_at?: string
          department_id: string
          description?: string | null
          direction?: Database["public"]["Enums"]["kpi_direction"]
          display_order?: number
          frequency?: Database["public"]["Enums"]["kpi_frequency"]
          green_threshold?: number | null
          id?: string
          is_active?: boolean
          is_hidden_from_trends?: boolean
          kpi_type?: Database["public"]["Enums"]["kpi_type"]
          mtd_aggregation?: Database["public"]["Enums"]["mtd_aggregation_type"]
          name: string
          target_value?: number | null
          unit?: string | null
        }
        Update: {
          amber_threshold?: number | null
          created_at?: string
          department_id?: string
          description?: string | null
          direction?: Database["public"]["Enums"]["kpi_direction"]
          display_order?: number
          frequency?: Database["public"]["Enums"]["kpi_frequency"]
          green_threshold?: number | null
          id?: string
          is_active?: boolean
          is_hidden_from_trends?: boolean
          kpi_type?: Database["public"]["Enums"]["kpi_type"]
          mtd_aggregation?: Database["public"]["Enums"]["mtd_aggregation_type"]
          name?: string
          target_value?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_master_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_attendance: {
        Row: {
          id: string
          invitee_id: string
          marked_at: string
          marked_by: string
          meeting_id: string
          remarks: string | null
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Insert: {
          id?: string
          invitee_id: string
          marked_at?: string
          marked_by: string
          meeting_id: string
          remarks?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
        }
        Update: {
          id?: string
          invitee_id?: string
          marked_at?: string
          marked_by?: string
          meeting_id?: string
          remarks?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
        }
        Relationships: [
          {
            foreignKeyName: "meeting_attendance_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "meeting_invitees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_attendance_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_decisions: {
        Row: {
          created_at: string
          created_by: string | null
          decision_text: string
          discussion_point_id: string | null
          id: string
          linked_task_id: string | null
          meeting_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decision_text: string
          discussion_point_id?: string | null
          id?: string
          linked_task_id?: string | null
          meeting_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decision_text?: string
          discussion_point_id?: string | null
          id?: string
          linked_task_id?: string | null
          meeting_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_decision_task"
            columns: ["linked_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_discussion_point_id_fkey"
            columns: ["discussion_point_id"]
            isOneToOne: false
            referencedRelation: "meeting_discussion_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_decisions_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_discussion_points: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          meeting_id: string
          notes: string | null
          sequence: number
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id: string
          notes?: string | null
          sequence?: number
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id?: string
          notes?: string | null
          sequence?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_discussion_points_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_discussion_points_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_invitees: {
        Row: {
          created_at: string
          department_id: string | null
          guest_designation: string | null
          guest_name: string | null
          id: string
          is_mandatory: boolean
          meeting_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          guest_designation?: string | null
          guest_name?: string | null
          id?: string
          is_mandatory?: boolean
          meeting_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          guest_designation?: string | null
          guest_name?: string | null
          id?: string
          is_mandatory?: boolean
          meeting_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_invitees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_invitees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_invitees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_template_invitees: {
        Row: {
          created_at: string
          id: string
          is_mandatory: boolean
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_mandatory?: boolean
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_mandatory?: boolean
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_template_invitees_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "meeting_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_template_invitees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_templates: {
        Row: {
          created_at: string
          created_by: string | null
          default_duration_minutes: number
          default_location: string | null
          default_start_time: string | null
          description: string | null
          factory_id: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          default_location?: string | null
          default_start_time?: string | null
          description?: string | null
          factory_id: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_duration_minutes?: number
          default_location?: string | null
          default_start_time?: string | null
          description?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_templates_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          created_at: string
          created_by: string | null
          facilitator_id: string
          factory_id: string
          id: string
          location: string | null
          scheduled_date: string
          scheduled_end_time: string
          scheduled_start_time: string
          status: Database["public"]["Enums"]["meeting_status"]
          summary: string | null
          title: string
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by?: string | null
          facilitator_id: string
          factory_id: string
          id?: string
          location?: string | null
          scheduled_date: string
          scheduled_end_time: string
          scheduled_start_time: string
          status?: Database["public"]["Enums"]["meeting_status"]
          summary?: string | null
          title: string
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          created_at?: string
          created_by?: string | null
          facilitator_id?: string
          factory_id?: string
          id?: string
          location?: string | null
          scheduled_date?: string
          scheduled_end_time?: string
          scheduled_start_time?: string
          status?: Database["public"]["Enums"]["meeting_status"]
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_facilitator_id_fkey"
            columns: ["facilitator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory"
            referencedColumns: ["id"]
          },
        ]
      }
      my_view_items: {
        Row: {
          created_at: string
          display_order: number
          id: string
          kpi_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          kpi_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          kpi_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "my_view_items_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "my_view_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pd_job_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          job_id: string
          stage_at_comment: Database["public"]["Enums"]["pd_stage"] | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          job_id: string
          stage_at_comment?: Database["public"]["Enums"]["pd_stage"] | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          job_id?: string
          stage_at_comment?: Database["public"]["Enums"]["pd_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "pd_job_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pd_job_comments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "pd_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pd_jobs: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer: string | null
          factory_id: string
          feedback_note: string | null
          id: string
          job_number: number
          previous_job_id: string | null
          product: string | null
          respawn_reason: string | null
          stage: Database["public"]["Enums"]["pd_stage"]
          substrate: string | null
          target_dispatch_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          factory_id: string
          feedback_note?: string | null
          id?: string
          job_number: number
          previous_job_id?: string | null
          product?: string | null
          respawn_reason?: string | null
          stage?: Database["public"]["Enums"]["pd_stage"]
          substrate?: string | null
          target_dispatch_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer?: string | null
          factory_id?: string
          feedback_note?: string | null
          id?: string
          job_number?: number
          previous_job_id?: string | null
          product?: string | null
          respawn_reason?: string | null
          stage?: Database["public"]["Enums"]["pd_stage"]
          substrate?: string | null
          target_dispatch_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pd_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pd_jobs_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pd_jobs_previous_job_id_fkey"
            columns: ["previous_job_id"]
            isOneToOne: false
            referencedRelation: "pd_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      pd_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_stage: Database["public"]["Enums"]["pd_stage"] | null
          id: string
          job_id: string
          note: string | null
          to_stage: Database["public"]["Enums"]["pd_stage"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["pd_stage"] | null
          id?: string
          job_id: string
          note?: string | null
          to_stage: Database["public"]["Enums"]["pd_stage"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_stage?: Database["public"]["Enums"]["pd_stage"] | null
          id?: string
          job_id?: string
          note?: string | null
          to_stage?: Database["public"]["Enums"]["pd_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "pd_stage_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pd_stage_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "pd_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_items: {
        Row: {
          completed_at: string | null
          created_at: string
          display_order: number
          due_date: string | null
          id: string
          is_completed: boolean
          notes: string | null
          origin_context: string | null
          recurrence_day_of_month: number | null
          recurrence_day_of_week: number | null
          recurrence_type: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          display_order?: number
          due_date?: string | null
          id?: string
          is_completed?: boolean
          notes?: string | null
          origin_context?: string | null
          recurrence_day_of_month?: number | null
          recurrence_day_of_week?: number | null
          recurrence_type?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          display_order?: number
          due_date?: string | null
          id?: string
          is_completed?: boolean
          notes?: string | null
          origin_context?: string | null
          recurrence_day_of_month?: number | null
          recurrence_day_of_week?: number | null
          recurrence_type?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_actual: {
        Row: {
          actual_date: string
          created_at: string
          id: string
          machine_id: string
          recorded_by: string | null
          remarks: string | null
          updated_at: string
        }
        Insert: {
          actual_date: string
          created_at?: string
          id?: string
          machine_id: string
          recorded_by?: string | null
          remarks?: string | null
          updated_at?: string
        }
        Update: {
          actual_date?: string
          created_at?: string
          id?: string
          machine_id?: string
          recorded_by?: string | null
          remarks?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_actual_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "pm_machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_actual_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_machines: {
        Row: {
          created_at: string
          display_order: number
          factory_id: string
          group_name: string
          id: string
          is_active: boolean
          is_critical: boolean
          line: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          factory_id: string
          group_name: string
          id?: string
          is_active?: boolean
          is_critical?: boolean
          line: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          factory_id?: string
          group_name?: string
          id?: string
          is_active?: boolean
          is_critical?: boolean
          line?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_machines_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory"
            referencedColumns: ["id"]
          },
        ]
      }
      pm_plan: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          machine_id: string
          planned_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id: string
          planned_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          machine_id?: string
          planned_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pm_plan_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pm_plan_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "pm_machines"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          designation: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          email: string
          employee_id?: string | null
          full_name: string
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          email?: string
          employee_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      project_item_stage_updates: {
        Row: {
          created_at: string
          id: string
          item_id: string
          reporting_date: string
          stage_name: string
          update_note: string | null
          updated_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          reporting_date?: string
          stage_name: string
          update_note?: string | null
          updated_by: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          reporting_date?: string
          stage_name?: string
          update_note?: string | null
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_item_stage_updates_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "project_tracker_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_item_stage_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tracker_items: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          description: string | null
          display_order: number
          id: string
          kpi_id: string
          status: Database["public"]["Enums"]["project_item_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string | null
          display_order?: number
          id?: string
          kpi_id: string
          status?: Database["public"]["Enums"]["project_item_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string | null
          display_order?: number
          id?: string
          kpi_id?: string
          status?: Database["public"]["Enums"]["project_item_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tracker_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tracker_items_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tracker_items_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_master"
            referencedColumns: ["id"]
          },
        ]
      }
      task_due_date_history: {
        Row: {
          changed_by: string
          created_at: string
          id: string
          new_due_date: string
          previous_due_date: string
          reason: string
          task_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string
          id?: string
          new_due_date: string
          previous_due_date: string
          reason: string
          task_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string
          id?: string
          new_due_date?: string
          previous_due_date?: string
          reason?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_due_date_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_due_date_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_group_members: {
        Row: {
          added_by: string | null
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "task_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_groups: {
        Row: {
          color: string
          created_at: string
          created_by: string
          factory_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          factory_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          factory_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_groups_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          created_at: string
          id: string
          new_due_date: string | null
          new_status: Database["public"]["Enums"]["task_status"] | null
          new_text: string | null
          previous_due_date: string | null
          previous_status: Database["public"]["Enums"]["task_status"] | null
          previous_text: string | null
          task_id: string
          update_note: string | null
          update_type: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_due_date?: string | null
          new_status?: Database["public"]["Enums"]["task_status"] | null
          new_text?: string | null
          previous_due_date?: string | null
          previous_status?: Database["public"]["Enums"]["task_status"] | null
          previous_text?: string | null
          task_id: string
          update_note?: string | null
          update_type?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          id?: string
          new_due_date?: string | null
          new_status?: Database["public"]["Enums"]["task_status"] | null
          new_text?: string | null
          previous_due_date?: string | null
          previous_status?: Database["public"]["Enums"]["task_status"] | null
          previous_text?: string | null
          task_id?: string
          update_note?: string | null
          update_type?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_by: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          department_id: string
          description: string | null
          due_date: string
          id: string
          is_carryover: boolean
          is_private: boolean
          origin_kpi_entry_id: string | null
          origin_meeting_id: string | null
          origin_type: Database["public"]["Enums"]["task_origin"]
          owner_id: string
          priority: Database["public"]["Enums"]["task_priority"]
          resolution_note: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_group_id: string | null
          task_number: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string | null
          due_date: string
          id?: string
          is_carryover?: boolean
          is_private?: boolean
          origin_kpi_entry_id?: string | null
          origin_meeting_id?: string | null
          origin_type?: Database["public"]["Enums"]["task_origin"]
          owner_id: string
          priority?: Database["public"]["Enums"]["task_priority"]
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_group_id?: string | null
          task_number?: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string | null
          due_date?: string
          id?: string
          is_carryover?: boolean
          is_private?: boolean
          origin_kpi_entry_id?: string | null
          origin_meeting_id?: string | null
          origin_type?: Database["public"]["Enums"]["task_origin"]
          owner_id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          resolution_note?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_group_id?: string | null
          task_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_origin_kpi_entry_id_fkey"
            columns: ["origin_kpi_entry_id"]
            isOneToOne: false
            referencedRelation: "kpi_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_origin_meeting_id_fkey"
            columns: ["origin_meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_task_group_id_fkey"
            columns: ["task_group_id"]
            isOneToOne: false
            referencedRelation: "task_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_departments: {
        Row: {
          created_at: string
          department_id: string
          id: string
          is_primary: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          is_primary?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          is_primary?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_departments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_departments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_departments: {
        Args: { p_user_id: string }
        Returns: {
          department_id: string
        }[]
      }
      has_role: {
        Args: {
          p_user_id: string
          required_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: boolean
      }
      is_dept_member: {
        Args: { p_department_id: string; p_user_id: string }
        Returns: boolean
      }
      is_group_creator: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { p_group_id: string; p_user_id: string }
        Returns: boolean
      }
      is_pd_team: { Args: { p_user_id: string }; Returns: boolean }
      spawn_pd_job_from: {
        Args: {
          p_new_target_dispatch_date: string
          p_new_title: string
          p_respawn_reason: string
          p_source_job_id: string
        }
        Returns: string
      }
      update_pd_job_stage: {
        Args: {
          p_feedback_note?: string
          p_job_id: string
          p_new_stage: Database["public"]["Enums"]["pd_stage"]
          p_note?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "factory_manager"
        | "department_head"
        | "team_member"
        | "shop_floor"
        | "task_only"
      attendance_status: "present" | "absent" | "excused"
      audit_action: "INSERT" | "UPDATE" | "DELETE"
      kpi_direction: "higher_is_better" | "lower_is_better" | "target_is_exact"
      kpi_frequency: "daily" | "weekly" | "monthly"
      kpi_type: "numeric" | "descriptive" | "project_tracker"
      meeting_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      mtd_aggregation_type: "sum" | "average" | "weighted_average"
      pd_stage:
        | "upcoming"
        | "in_process"
        | "processing_finished"
        | "feedback_approved"
        | "feedback_rejected"
        | "abandoned"
      project_item_status: "active" | "completed" | "on_hold" | "dropped"
      rag_status: "red" | "amber" | "green"
      task_origin: "meeting" | "kpi_red" | "standalone"
      task_priority: "low" | "medium" | "high" | "critical"
      task_status:
        | "open"
        | "in_progress"
        | "blocked"
        | "completed"
        | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "super_admin",
        "factory_manager",
        "department_head",
        "team_member",
        "shop_floor",
        "task_only",
      ],
      attendance_status: ["present", "absent", "excused"],
      audit_action: ["INSERT", "UPDATE", "DELETE"],
      kpi_direction: ["higher_is_better", "lower_is_better", "target_is_exact"],
      kpi_frequency: ["daily", "weekly", "monthly"],
      kpi_type: ["numeric", "descriptive", "project_tracker"],
      meeting_status: ["scheduled", "in_progress", "completed", "cancelled"],
      mtd_aggregation_type: ["sum", "average", "weighted_average"],
      pd_stage: [
        "upcoming",
        "in_process",
        "processing_finished",
        "feedback_approved",
        "feedback_rejected",
        "abandoned",
      ],
      project_item_status: ["active", "completed", "on_hold", "dropped"],
      rag_status: ["red", "amber", "green"],
      task_origin: ["meeting", "kpi_red", "standalone"],
      task_priority: ["low", "medium", "high", "critical"],
      task_status: ["open", "in_progress", "blocked", "completed", "cancelled"],
    },
  },
} as const
