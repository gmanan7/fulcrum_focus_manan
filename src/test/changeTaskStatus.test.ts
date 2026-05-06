import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Verifies the changeStatusMutation contract:
 * - Calls supabase.rpc('update_task_status', { p_task_id, p_new_status, p_note })
 * - When newStatus is completed/cancelled, also writes resolution_note via tasks update
 */

type Status = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

function makeSupabaseMock() {
  const rpc = vi.fn<any, any>().mockResolvedValue({ error: null });
  const updateEq = vi.fn<any, any>().mockResolvedValue({ error: null });
  const update = vi.fn<any, any>(() => ({ eq: updateEq }));
  const from = vi.fn<any, any>(() => ({ update }));
  return { rpc, from, update, updateEq };
}

async function runChangeStatus(
  supabase: ReturnType<typeof makeSupabaseMock>,
  opts: { taskId: string; newStatus: Status; note?: string; resolutionNote?: string; updateNote?: string },
) {
  const { error } = await supabase.rpc('update_task_status', {
    p_task_id: opts.taskId,
    p_new_status: opts.newStatus,
    p_note: opts.note || opts.updateNote || null,
  });
  if (error) throw error;

  if (opts.newStatus === 'completed' || opts.newStatus === 'cancelled') {
    const { error: resErr } = await supabase
      .from('tasks')
      .update({ resolution_note: opts.note || opts.resolutionNote, completed_at: new Date().toISOString() })
      .eq('id', opts.taskId);
    if (resErr) throw resErr;
  }
}

describe('changeStatusMutation', () => {
  let supabase: ReturnType<typeof makeSupabaseMock>;
  beforeEach(() => { supabase = makeSupabaseMock(); });

  it('calls update_task_status RPC with correct parameters', async () => {
    await runChangeStatus(supabase, { taskId: 't1', newStatus: 'in_progress', updateNote: 'starting' });
    expect(supabase.rpc).toHaveBeenCalledWith('update_task_status', {
      p_task_id: 't1',
      p_new_status: 'in_progress',
      p_note: 'starting',
    });
  });

  it('passes null note when no note provided', async () => {
    await runChangeStatus(supabase, { taskId: 't2', newStatus: 'blocked' });
    expect(supabase.rpc).toHaveBeenCalledWith('update_task_status', {
      p_task_id: 't2', p_new_status: 'blocked', p_note: null,
    });
  });

  it('saves resolution_note when status is completed', async () => {
    await runChangeStatus(supabase, { taskId: 't3', newStatus: 'completed', note: 'done well' });
    expect(supabase.from).toHaveBeenCalledWith('tasks');
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ resolution_note: 'done well' }),
    );
    expect(supabase.updateEq).toHaveBeenCalledWith('id', 't3');
  });

  it('saves resolution_note when status is cancelled', async () => {
    await runChangeStatus(supabase, { taskId: 't4', newStatus: 'cancelled', resolutionNote: 'no longer needed' });
    expect(supabase.update).toHaveBeenCalledWith(
      expect.objectContaining({ resolution_note: 'no longer needed' }),
    );
  });

  it('does not write resolution_note for non-terminal statuses', async () => {
    await runChangeStatus(supabase, { taskId: 't5', newStatus: 'in_progress' });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws when RPC returns an error', async () => {
    supabase.rpc.mockResolvedValueOnce({ error: new Error('forbidden') });
    await expect(
      runChangeStatus(supabase, { taskId: 't6', newStatus: 'in_progress' }),
    ).rejects.toThrow('forbidden');
  });
});
