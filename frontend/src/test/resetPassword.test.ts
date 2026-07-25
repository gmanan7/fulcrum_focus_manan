import { describe, it, expect } from 'vitest';
import { validateResetPassword } from '@/lib/utils';

describe('validateResetPassword', () => {
  it('returns error when passwords differ', () => {
    const result = validateResetPassword('Password1', 'Password2');
    expect(result).toBe('Passwords do not match');
  });

  it('returns error when password is under 8 characters', () => {
    const result = validateResetPassword('Pass1', 'Pass1');
    expect(result).toBe('Password must be at least 8 characters');
  });

  it('returns null for valid matching passwords of 8+ chars', () => {
    const result = validateResetPassword('ValidPass1', 'ValidPass1');
    expect(result).toBeNull();
  });

  it('returns length error even if passwords match but too short', () => {
    const result = validateResetPassword('abc', 'abc');
    expect(result).toBe('Password must be at least 8 characters');
  });

  it('returns null for exactly 8 character matching passwords', () => {
    const result = validateResetPassword('12345678', '12345678');
    expect(result).toBeNull();
  });
});
