import { supabase } from '@/integrations/supabase/client';

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export async function logAudit(
  tableName: string,
  recordId: string,
  action: AuditAction,
  oldValues: Record<string, any> | null = null,
  newValues: Record<string, any> | null = null,
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('audit_logs').insert({
      table_name: tableName,
      record_id: recordId,
      action,
      old_values: oldValues,
      new_values: newValues,
      performed_by: user.id,
    });
    if (error) {
      console.warn('Audit log insert failed:', error.message);
    }
  } catch (e) {
    console.warn('Audit log failed:', e);
  }
}
