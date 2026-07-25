import { query } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { PdJob, PdStage } from '../types/index.js';

export class PDService {
  static async getPDJobs(departmentId?: string, stage?: string): Promise<PdJob[]> {
    let sql = `SELECT * FROM pd_jobs WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (departmentId) {
      sql += ` AND department_id = $${idx++}`;
      params.push(departmentId);
    }
    if (stage) {
      sql += ` AND stage = $${idx++}`;
      params.push(stage);
    }

    sql += ` ORDER BY updated_at DESC`;
    const res = await query(sql, params);
    return res.rows;
  }

  static async getPDJobById(id: string): Promise<PdJob> {
    const res = await query('SELECT * FROM pd_jobs WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new NotFoundError('PD Job not found');
    }
    return res.rows[0];
  }

  static async createPDJob(data: Partial<PdJob>): Promise<PdJob> {
    const res = await query(
      `INSERT INTO pd_jobs (department_id, job_number, title, stage, current_notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        data.department_id,
        data.job_number,
        data.title,
        data.stage || 'upcoming',
        data.current_notes || null,
      ]
    );
    return res.rows[0];
  }

  static async updatePDStage(id: string, newStage: PdStage, updatedBy?: string, notes?: string): Promise<PdJob> {
    const job = await this.getPDJobById(id);
    const oldStage = job.stage;

    await query('UPDATE pd_jobs SET stage = $1, current_notes = $2, updated_at = NOW() WHERE id = $3', [newStage, notes || null, id]);

    await query(
      `INSERT INTO pd_stage_history (pd_job_id, old_stage, new_stage, changed_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, oldStage, newStage, updatedBy || null, notes || null]
    );

    return this.getPDJobById(id);
  }

  static async getStageHistory(pdJobId: string) {
    const res = await query(
      `SELECT h.*, p.full_name as changed_by_name
       FROM pd_stage_history h
       LEFT JOIN profiles p ON h.changed_by = p.id
       WHERE h.pd_job_id = $1
       ORDER BY h.changed_at DESC`,
      [pdJobId]
    );
    return res.rows;
  }
}

export default PDService;
