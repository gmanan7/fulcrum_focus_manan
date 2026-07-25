/**
 * Pure validator for the Change Password form.
 * Returns an error message or null when input is valid.
 */
export function validateChangePassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): string | null {
  if (!currentPassword) return 'Current password is required';
  if (!newPassword || !confirmPassword) return 'New password is required';
  if (newPassword.length < 8) return 'New password must be at least 8 characters';
  if (newPassword !== confirmPassword) return 'New passwords do not match';
  if (newPassword === currentPassword) return 'New password must differ from current password';
  return null;
}

/**
 * Client-side rate limiter for password change attempts.
 * Returns true if a new attempt is allowed given the timestamps of recent attempts.
 * Allows up to `max` attempts per `windowMs` window.
 */
export function isAttemptAllowed(
  attempts: number[],
  now: number,
  max = 5,
  windowMs = 60_000,
): boolean {
  const recent = attempts.filter((t) => now - t < windowMs);
  return recent.length < max;
}
