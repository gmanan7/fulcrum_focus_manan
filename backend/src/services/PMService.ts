import { query } from '../config/database.js';
import { PmMachine } from '../types/index.js';

export class PMService {
  static async getMachines(departmentId?: string): Promise<PmMachine[]> {
    if (departmentId) {
      const res = await query('SELECT * FROM pm_machines WHERE department_id = $1 AND is_active = true ORDER BY name ASC', [departmentId]);
      return res.rows;
    }
    const res = await query('SELECT * FROM pm_machines WHERE is_active = true ORDER BY name ASC');
    return res.rows;
  }

  static async createMachine(data: Partial<PmMachine>): Promise<PmMachine> {
    const res = await query(
      `INSERT INTO pm_machines (department_id, machine_code, name, location)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [data.department_id, data.machine_code, data.name, data.location || null]
    );
    return res.rows[0];
  }

  static async getSchedules(machineId?: string, monthYear?: string) {
    let sql = `SELECT s.*, m.name as machine_name, m.machine_code
               FROM pm_schedules s
               JOIN pm_machines m ON s.machine_id = m.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (machineId) {
      sql += ` AND s.machine_id = $${idx++}`;
      params.push(machineId);
    }
    if (monthYear) {
      sql += ` AND s.month_year = $${idx++}`;
      params.push(monthYear);
    }

    sql += ` ORDER BY s.scheduled_date ASC`;
    const res = await query(sql, params);
    return res.rows;
  }
}

export default PMService;
