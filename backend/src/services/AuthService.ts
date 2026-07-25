import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { generateToken } from '../utils/jwt.js';
import { UnauthorizedError, NotFoundError, ConflictError } from '../utils/errors.js';
import { UserProfile, AppRole } from '../types/index.js';

export class AuthService {
  static async login(email: string, password: string) {
    const userRes = await query('SELECT * FROM profiles WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const user = userRes.rows[0];
    if (!user.is_active) {
      throw new UnauthorizedError('Account is disabled');
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const rolesRes = await query('SELECT role FROM user_roles WHERE user_id = $1', [user.id]);
    const roles: AppRole[] = rolesRes.rows.map((r) => r.role);

    const token = generateToken({
      userId: user.id,
      email: user.email,
      roles,
    });

    const { password_hash, ...profile } = user;
    return {
      token,
      user: {
        ...profile,
        roles,
      },
    };
  }

  static async register(fullName: string, email: string, password: string, employeeId?: string, designation?: string) {
    const existing = await query('SELECT id FROM profiles WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      throw new ConflictError('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertRes = await query(
      `INSERT INTO profiles (full_name, email, password_hash, employee_id, designation)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, full_name, email, employee_id, designation, is_active, created_at, updated_at`,
      [fullName, email, hashedPassword, employeeId || null, designation || null]
    );

    const newUser = insertRes.rows[0];

    // Assign default role: team_member
    await query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2)', [newUser.id, 'team_member']);

    const token = generateToken({
      userId: newUser.id,
      email: newUser.email,
      roles: ['team_member'],
    });

    return {
      token,
      user: {
        ...newUser,
        roles: ['team_member'],
      },
    };
  }

  static async getUserProfile(userId: string): Promise<UserProfile> {
    const userRes = await query('SELECT id, full_name, email, employee_id, designation, is_active, created_at, updated_at FROM profiles WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      throw new NotFoundError('User profile not found');
    }

    const user = userRes.rows[0];

    const rolesRes = await query('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
    user.roles = rolesRes.rows.map((r) => r.role);

    const deptsRes = await query(
      `SELECT d.* FROM department d
       JOIN user_departments ud ON ud.department_id = d.id
       WHERE ud.user_id = $1`,
      [userId]
    );
    user.departments = deptsRes.rows;

    return user;
  }

  static async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const userRes = await query('SELECT password_hash FROM profiles WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const valid = await bcrypt.compare(oldPassword, userRes.rows[0].password_hash);
    if (!valid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const newHashed = await bcrypt.hash(newPassword, 10);
    await query('UPDATE profiles SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHashed, userId]);

    return { success: true, message: 'Password updated successfully' };
  }

  static async getUserRoles(userId: string): Promise<AppRole[]> {
    const res = await query('SELECT role FROM user_roles WHERE user_id = $1', [userId]);
    return res.rows.map((r) => r.role);
  }
}

export default AuthService;
