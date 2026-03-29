import { supabase } from '@/integrations/supabase/client';

type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE';

export async function logAudit(
  tableName: string,
  recordId: string,
  action: AuditAction,
  oldValues: Record<string, any> | null = null,
  newValues: Record<string, any> | null = null,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('audit_logs').insert({
    table_name: tableName,
    record_id: recordId,
    action,
    old_values: oldValues as any,
    new_values: newValues as any,
    performed_by: user.id,
  });
}
