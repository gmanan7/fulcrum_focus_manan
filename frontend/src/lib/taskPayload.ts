/**
 * Build the insert payload for a task created from the standalone modal.
 * When `meetingId` is provided, the task is linked to that meeting and gets
 * origin_type='meeting'. Otherwise it is a standalone task.
 *
 * Pure helper — no side effects — so it can be unit-tested.
 */
export interface BuildTaskPayloadInput {
  title: string;
  description?: string | null;
  departmentId: string;
  ownerId: string;
  assignedBy: string;
  createdBy: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate: string;
  meetingId?: string | null;
}

export interface TaskInsertPayload {
  title: string;
  description: string | null;
  department_id: string;
  owner_id: string;
  assigned_by: string;
  created_by: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date: string;
  origin_type: 'meeting' | 'standalone';
  origin_meeting_id: string | null;
}

export function buildTaskPayload(input: BuildTaskPayloadInput): TaskInsertPayload {
  return {
    title: input.title,
    description: input.description ? input.description : null,
    department_id: input.departmentId,
    owner_id: input.ownerId,
    assigned_by: input.assignedBy,
    created_by: input.createdBy,
    priority: input.priority,
    due_date: input.dueDate,
    origin_type: input.meetingId ? 'meeting' : 'standalone',
    origin_meeting_id: input.meetingId || null,
  };
}
