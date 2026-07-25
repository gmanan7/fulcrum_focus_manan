import { query } from '../config/database.js';
import { AuditLog } from '../types/index.js';

export class AuditService {
  static async getAuditLogs(tableName?: string, action?: string, limit = 100): Promise<AuditLog[]> {
    let sql = `SELECT a.*, p.full_name as user_name, p.email as user_email
               FROM audit_logs a
               LEFT JOIN profiles p ON a.performed_by = p.id
               WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (tableName) {
      sql += ` AND a.table_name = $${idx++}`;
      params.push(tableName);
    }
    if (action) {
      sql += ` AND a.action = $${idx++}`;
      params.push(action);
    }

    sql += ` ORDER BY a.created_at DESC LIMIT $${idx}`;
    params.push(limit);

    const res = await query(sql, params);
    return res.rows;
  }
}

export default AuditService;
