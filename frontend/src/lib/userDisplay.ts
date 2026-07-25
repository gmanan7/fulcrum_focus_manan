/**
 * Pure helpers for user identity display + sign-out access invariants.
 * Identity and Sign Out are NEVER role-conditional.
 */

export function isSignOutAlwaysRendered(_role?: string | null): boolean {
  // Sign Out must be accessible to every authenticated user, regardless of role.
  return true;
}

export function getUserDisplayName(
  profile: { full_name?: string | null } | null | undefined,
): string {
  const name = profile?.full_name?.trim();
  return name && name.length > 0 ? name : '';
}

export function getUserInitials(fullName: string | null | undefined): string {
  if (!fullName) return '?';
  const trimmed = fullName.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]!.toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}
