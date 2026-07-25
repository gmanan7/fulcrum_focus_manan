import { query } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { UserProfile, AppRole } from '../types/index.js';

export class UserService {
  static async getAllUsers(): Promise<UserProfile[]> {
    const res = await query(
      `SELECT id, full_name, email, employee_id, designation, is_active, created_at, updated_at
       FROM profiles ORDER BY full_name ASC`
    );

    const users = res.rows;
    for (const u of users) {
      const rolesRes = await query('SELECT role FROM user_roles WHERE user_id = $1', [u.id]);
      u.roles = rolesRes.rows.map((r) => r.role);
    }
    return users;
  }

  static async getUserById(id: string): Promise<UserProfile> {
    const res = await query(
      `SELECT id, full_name, email, employee_id, designation, is_active, created_at, updated_at
       FROM profiles WHERE id = $1`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const user = res.rows[0];
    const rolesRes = await query('SELECT role FROM user_roles WHERE user_id = $1', [id]);
    user.roles = rolesRes.rows.map((r) => r.role);

    const deptsRes = await query(
      `SELECT d.* FROM department d
       JOIN user_departments ud ON ud.department_id = d.id
       WHERE ud.user_id = $1`,
      [id]
    );
    user.departments = deptsRes.rows;

    return user;
  }

  static async updateUser(id: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.full_name !== undefined) {
      fields.push(`full_name = $${idx++}`);
      values.push(data.full_name);
    }
    if (data.employee_id !== undefined) {
      fields.push(`employee_id = $${idx++}`);
      values.push(data.employee_id);
    }
    if (data.designation !== undefined) {
      fields.push(`designation = $${idx++}`);
      values.push(data.designation);
    }
    if (data.is_active !== undefined) {
      fields.push(`is_active = $${idx++}`);
      values.push(data.is_active);
    }

    if (fields.length === 0) {
      return this.getUserById(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await query(`UPDATE profiles SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    return this.getUserById(id);
  }

  static async setUserRoles(userId: string, roles: AppRole[]): Promise<AppRole[]> {
    await query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    for (const role of roles) {
      await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [userId, role]);
    }
    return roles;
  }

  static async setUserDepartments(userId: string, departmentIds: string[], primaryDeptId?: string): Promise<void> {
    await query('DELETE FROM user_departments WHERE user_id = $1', [userId]);
    for (const deptId of departmentIds) {
      const isPrimary = deptId === primaryDeptId;
      await query('INSERT INTO user_departments (user_id, department_id, is_primary) VALUES ($1, $2, $3)', [userId, deptId, isPrimary]);
    }
  }
}

export default UserService;
