import { query } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { computeRagStatus } from '../utils/rag.js';
import { KpiMaster, KpiEntry } from '../types/index.js';

export class KPIService {
  static async getKPIs(departmentId?: string): Promise<KpiMaster[]> {
    if (departmentId) {
      const res = await query('SELECT * FROM kpi_master WHERE department_id = $1 AND is_active = true ORDER BY display_order ASC', [departmentId]);
      return res.rows;
    }
    const res = await query('SELECT * FROM kpi_master WHERE is_active = true ORDER BY display_order ASC');
    return res.rows;
  }

  static async getKPIById(id: string): Promise<KpiMaster> {
    const res = await query('SELECT * FROM kpi_master WHERE id = $1', [id]);
    if (res.rows.length === 0) {
      throw new NotFoundError('KPI master not found');
    }
    return res.rows[0];
  }

  static async createKPI(data: Partial<KpiMaster>): Promise<KpiMaster> {
    const res = await query(
      `INSERT INTO kpi_master (department_id, name, unit, kpi_type, frequency, direction, target_value, green_threshold, amber_threshold, mtd_aggregation, display_order, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        data.department_id,
        data.name,
        data.unit || null,
        data.kpi_type || 'numeric',
        data.frequency || 'daily',
        data.direction || 'higher_is_better',
        data.target_value ?? null,
        data.green_threshold ?? null,
        data.amber_threshold ?? null,
        data.mtd_aggregation || 'sum',
        data.display_order || 0,
        data.description || null,
      ]
    );
    return res.rows[0];
  }

  static async updateKPI(id: string, data: Partial<KpiMaster>): Promise<KpiMaster> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const keys: (keyof KpiMaster)[] = [
      'name', 'unit', 'kpi_type', 'frequency', 'direction',
      'target_value', 'green_threshold', 'amber_threshold',
      'mtd_aggregation', 'display_order', 'is_active', 'description'
    ];

    for (const key of keys) {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${idx++}`);
        values.push(data[key]);
      }
    }

    if (fields.length === 0) {
      return this.getKPIById(id);
    }

    values.push(id);
    const res = await query(`UPDATE kpi_master SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return res.rows[0];
  }

  static async deleteKPI(id: string): Promise<void> {
    await query('UPDATE kpi_master SET is_active = false WHERE id = $1', [id]);
  }

  static async getEntries(kpiId: string, startDate?: string, endDate?: string): Promise<KpiEntry[]> {
    if (startDate && endDate) {
      const res = await query(
        'SELECT * FROM kpi_entries WHERE kpi_id = $1 AND reporting_date BETWEEN $2 AND $3 ORDER BY reporting_date DESC',
        [kpiId, startDate, endDate]
      );
      return res.rows;
    }
    const res = await query('SELECT * FROM kpi_entries WHERE kpi_id = $1 ORDER BY reporting_date DESC LIMIT 100', [kpiId]);
    return res.rows;
  }

  static async submitEntry(entry: {
    kpi_id: string;
    reporting_date: string;
    actual_value?: number;
    text_value?: string;
    meeting_id?: string;
    notes?: string;
    entered_by?: string;
  }): Promise<KpiEntry> {
    const kpi = await this.getKPIById(entry.kpi_id);

    let status = null;
    if (entry.actual_value !== undefined && entry.actual_value !== null) {
      status = computeRagStatus({
        actualValue: Number(entry.actual_value),
        targetValue: kpi.target_value,
        greenThreshold: kpi.green_threshold,
        amberThreshold: kpi.amber_threshold,
        direction: kpi.direction,
      });
    }

    const res = await query(
      `INSERT INTO kpi_entries (kpi_id, reporting_date, actual_value, text_value, computed_status, meeting_id, notes, entered_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (kpi_id, reporting_date)
       DO UPDATE SET actual_value = EXCLUDED.actual_value,
                     text_value = EXCLUDED.text_value,
                     computed_status = EXCLUDED.computed_status,
                     notes = EXCLUDED.notes,
                     entered_by = EXCLUDED.entered_by,
                     updated_at = NOW()
       RETURNING *`,
      [
        entry.kpi_id,
        entry.reporting_date,
        entry.actual_value ?? null,
        entry.text_value || null,
        status,
        entry.meeting_id || null,
        entry.notes || null,
        entry.entered_by || null,
      ]
    );

    return res.rows[0];
  }

  static async getKPICharts(departmentId?: string) {
    if (departmentId) {
      const res = await query('SELECT * FROM kpi_charts WHERE department_id = $1 AND is_active = true ORDER BY display_order ASC', [departmentId]);
      return res.rows;
    }
    const res = await query('SELECT * FROM kpi_charts WHERE is_active = true ORDER BY display_order ASC');
    return res.rows;
  }
}

export default KPIService;
