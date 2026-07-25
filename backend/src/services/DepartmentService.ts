import { query } from '../config/database.js';
import { Department, Factory } from '../types/index.js';

export class DepartmentService {
  static async getFactories(): Promise<Factory[]> {
    const res = await query('SELECT * FROM factory ORDER BY name ASC');
    return res.rows;
  }

  static async getDepartments(factoryId?: string): Promise<Department[]> {
    if (factoryId) {
      const res = await query('SELECT * FROM department WHERE factory_id = $1 ORDER BY display_order ASC, name ASC', [factoryId]);
      return res.rows;
    }
    const res = await query('SELECT * FROM department ORDER BY display_order ASC, name ASC');
    return res.rows;
  }

  static async createDepartment(factoryId: string, name: string, code: string, displayOrder = 0): Promise<Department> {
    const res = await query(
      `INSERT INTO department (factory_id, name, code, display_order)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [factoryId, name, code, displayOrder]
    );
    return res.rows[0];
  }

  static async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.code !== undefined) {
      fields.push(`code = $${idx++}`);
      values.push(data.code);
    }
    if (data.display_order !== undefined) {
      fields.push(`display_order = $${idx++}`);
      values.push(data.display_order);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) {
      const existing = await query('SELECT * FROM department WHERE id = $1', [id]);
      return existing.rows[0];
    }

    values.push(id);
    const res = await query(`UPDATE department SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return res.rows[0];
  }
}

export default DepartmentService;
