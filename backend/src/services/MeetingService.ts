import { query } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { Meeting, MeetingDecision } from '../types/index.js';

export class MeetingService {
  static async getMeetings(departmentId?: string, date?: string): Promise<Meeting[]> {
    let sql = `SELECT m.*, d.name as department_name FROM meetings m LEFT JOIN department d ON m.department_id = d.id WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (departmentId) {
      sql += ` AND m.department_id = $${idx++}`;
      params.push(departmentId);
    }
    if (date) {
      sql += ` AND m.meeting_date = $${idx++}`;
      params.push(date);
    }

    sql += ` ORDER BY m.meeting_date DESC, m.created_at DESC`;
    const res = await query(sql, params);
    return res.rows;
  }

  static async getMeetingById(id: string): Promise<Meeting> {
    const res = await query(`SELECT m.*, d.name as department_name FROM meetings m LEFT JOIN department d ON m.department_id = d.id WHERE m.id = $1`, [id]);
    if (res.rows.length === 0) {
      throw new NotFoundError('Meeting not found');
    }
    return res.rows[0];
  }

  static async createMeeting(data: Partial<Meeting>): Promise<Meeting> {
    const res = await query(
      `INSERT INTO meetings (department_id, title, meeting_date, status, summary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.department_id,
        data.title,
        data.meeting_date,
        data.status || 'scheduled',
        data.summary || null,
        data.created_by || null,
      ]
    );
    return res.rows[0];
  }

  static async updateMeeting(id: string, data: Partial<Meeting>): Promise<Meeting> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(data.title);
    }
    if (data.meeting_date !== undefined) {
      fields.push(`meeting_date = $${idx++}`);
      values.push(data.meeting_date);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }
    if (data.summary !== undefined) {
      fields.push(`summary = $${idx++}`);
      values.push(data.summary);
    }

    if (fields.length === 0) {
      return this.getMeetingById(id);
    }

    values.push(id);
    const res = await query(`UPDATE meetings SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    return res.rows[0];
  }

  static async getAttendees(meetingId: string) {
    const res = await query(
      `SELECT ma.*, p.full_name, p.email, p.designation
       FROM meeting_attendees ma
       JOIN profiles p ON ma.user_id = p.id
       WHERE ma.meeting_id = $1`,
      [meetingId]
    );
    return res.rows;
  }

  static async getDecisions(meetingId: string): Promise<MeetingDecision[]> {
    const res = await query('SELECT * FROM meeting_decisions WHERE meeting_id = $1 ORDER BY created_at ASC', [meetingId]);
    return res.rows;
  }

  static async createDecision(meetingId: string, decisionText: string): Promise<MeetingDecision> {
    const res = await query(
      `INSERT INTO meeting_decisions (meeting_id, decision_text)
       VALUES ($1, $2) RETURNING *`,
      [meetingId, decisionText]
    );
    return res.rows[0];
  }
}

export default MeetingService;
