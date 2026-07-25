import { query } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { Task, TaskStatus, TaskGroup } from '../types/index.js';

export class TaskService {
  static async getAllTasks(filters: { departmentId?: string; status?: string; assigneeId?: string; meetingId?: string }): Promise<Task[]> {
    let sql = `SELECT t.*, p.full_name as assignee_name, d.name as department_name
               FROM tasks t
               LEFT JOIN profiles p ON t.assignee_id = p.id
               LEFT JOIN department d ON t.department_id = d.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (filters.departmentId) {
      sql += ` AND t.department_id = $${idx++}`;
      params.push(filters.departmentId);
    }
    if (filters.status) {
      sql += ` AND t.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.assigneeId) {
      sql += ` AND t.assignee_id = $${idx++}`;
      params.push(filters.assigneeId);
    }
    if (filters.meetingId) {
      sql += ` AND t.meeting_id = $${idx++}`;
      params.push(filters.meetingId);
    }

    sql += ` ORDER BY t.created_at DESC`;
    const res = await query(sql, params);
    return res.rows;
  }

  static async getTaskById(id: string): Promise<Task> {
    const res = await query(
      `SELECT t.*, p.full_name as assignee_name, d.name as department_name
       FROM tasks t
       LEFT JOIN profiles p ON t.assignee_id = p.id
       LEFT JOIN department d ON t.department_id = d.id
       WHERE t.id = $1`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new NotFoundError('Task not found');
    }
    return res.rows[0];
  }

  static async createTask(data: Partial<Task>): Promise<Task> {
    const res = await query(
      `INSERT INTO tasks (title, description, department_id, assignee_id, creator_id, due_date, priority, status, origin, meeting_id, kpi_id, task_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        data.title,
        data.description || null,
        data.department_id,
        data.assignee_id || null,
        data.creator_id || null,
        data.due_date || null,
        data.priority || 'medium',
        data.status || 'open',
        data.origin || 'standalone',
        data.meeting_id || null,
        data.kpi_id || null,
        data.task_group_id || null,
      ]
    );
    return res.rows[0];
  }

  static async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    const existing = await this.getTaskById(id);

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const keys: (keyof Task)[] = [
      'title', 'description', 'department_id', 'assignee_id',
      'due_date', 'priority', 'status', 'task_group_id'
    ];

    for (const key of keys) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const res = await query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return res.rows[0];
  }

  static async updateTaskStatus(id: string, newStatus: TaskStatus, updatedBy?: string, reason?: string): Promise<Task> {
    const task = await this.getTaskById(id);
    const oldStatus = task.status;

    await query('UPDATE tasks SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, id]);

    await query(
      `INSERT INTO task_status_history (task_id, old_status, new_status, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, oldStatus, newStatus, updatedBy || null, reason || null]
    );

    return this.getTaskById(id);
  }

  static async updateTaskDueDate(id: string, newDueDate: string, updatedBy?: string, reason?: string): Promise<Task> {
    const task = await this.getTaskById(id);
    const oldDueDate = task.due_date;

    await query('UPDATE tasks SET due_date = $1, updated_at = NOW() WHERE id = $2', [newDueDate, id]);

    await query(
      `INSERT INTO task_due_date_history (task_id, old_due_date, new_due_date, changed_by, reason)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, oldDueDate || null, newDueDate, updatedBy || null, reason || null]
    );

    return this.getTaskById(id);
  }

  static async deleteTask(id: string): Promise<void> {
    await query('DELETE FROM tasks WHERE id = $1', [id]);
  }

  static async getTaskGroups(departmentId?: string): Promise<TaskGroup[]> {
    if (departmentId) {
      const res = await query('SELECT * FROM task_groups WHERE department_id = $1 ORDER BY display_order ASC', [departmentId]);
      return res.rows;
    }
    const res = await query('SELECT * FROM task_groups ORDER BY display_order ASC');
    return res.rows;
  }
}

export default TaskService;
