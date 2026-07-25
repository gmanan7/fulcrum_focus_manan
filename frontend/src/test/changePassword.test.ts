import { describe, it, expect } from 'vitest';
import { validateChangePassword, isAttemptAllowed } from '@/lib/changePassword';

describe('validateChangePassword', () => {
  it('requires current password', () => {
    expect(validateChangePassword('', 'NewPass12', 'NewPass12')).toBe('Current password is required');
  });

  it('requires new password', () => {
    expect(validateChangePassword('curr', '', '')).toBe('New password is required');
  });

  it('rejects new password under 8 chars', () => {
    expect(validateChangePassword('curr', 'short', 'short')).toBe('New password must be at least 8 characters');
  });

  it('rejects mismatched confirm', () => {
    expect(validateChangePassword('curr', 'ValidPass1', 'OtherPass1')).toBe('New passwords do not match');
  });

  it('rejects new equal to current', () => {
    expect(validateChangePassword('SamePass1', 'SamePass1', 'SamePass1')).toBe('New password must differ from current password');
  });

  it('returns null when valid', () => {
    expect(validateChangePassword('OldPass12', 'NewPass12', 'NewPass12')).toBeNull();
  });
});

describe('isAttemptAllowed', () => {
  it('allows when fewer than 5 attempts in window', () => {
    const now = 10_000;
    expect(isAttemptAllowed([1000, 2000, 3000, 4000], now)).toBe(true);
  });

  it('blocks when 5 attempts in last minute', () => {
    const now = 10_000;
    expect(isAttemptAllowed([1000, 2000, 3000, 4000, 5000], now)).toBe(false);
  });

  it('ignores attempts older than the window', () => {
    const now = 100_000;
    expect(isAttemptAllowed([1000, 2000, 3000, 4000, 5000], now)).toBe(true);
  });
});
