import { query } from '../config/database.js';
import { Project, ProjectItem } from '../types/index.js';

export class ProjectService {
  static async getProjects(departmentId?: string): Promise<Project[]> {
    if (departmentId) {
      const res = await query('SELECT * FROM projects WHERE department_id = $1 AND is_active = true ORDER BY name ASC', [departmentId]);
      return res.rows;
    }
    const res = await query('SELECT * FROM projects WHERE is_active = true ORDER BY name ASC');
    return res.rows;
  }

  static async createProject(data: Partial<Project>): Promise<Project> {
    const res = await query(
      `INSERT INTO projects (department_id, name, code, description, owner_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.department_id, data.name, data.code || null, data.description || null, data.owner_id || null]
    );
    return res.rows[0];
  }

  static async getProjectItems(projectId: string): Promise<ProjectItem[]> {
    const res = await query('SELECT * FROM project_items WHERE project_id = $1 ORDER BY created_at ASC', [projectId]);
    return res.rows;
  }

  static async createProjectItem(data: Partial<ProjectItem>): Promise<ProjectItem> {
    const res = await query(
      `INSERT INTO project_items (project_id, title, status, target_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.project_id, data.title, data.status || 'active', data.target_date || null]
    );
    return res.rows[0];
  }

  static async updateProjectItem(id: string, data: Partial<ProjectItem>): Promise<ProjectItem> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(data.title);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    if (data.target_date !== undefined) {
      fields.push(`target_date = $${idx++}`);
      values.push(data.target_date);
    }

    if (fields.length === 0) {
      const existing = await query('SELECT * FROM project_items WHERE id = $1', [id]);
      return existing.rows[0];
    }

    values.push(id);
    const res = await query(`UPDATE project_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return res.rows[0];
  }
}

export default ProjectService;
