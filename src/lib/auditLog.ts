// Audit logging is now handled server-side via database triggers.
// This file is kept for backward compatibility but is a no-op.

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export async function logAudit(
  _tableName: string,
  _recordId: string,
  _action: AuditAction,
  _oldValues: Record<string, any> | null = null,
  _newValues: Record<string, any> | null = null,
) {
  // No-op: audit_logs are now populated by PostgreSQL triggers (audit_trigger_fn)
}
