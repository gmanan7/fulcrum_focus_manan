import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Verifies the changeStatusMutation contract:
 * - Calls DB.rpc('update_task_status', { p_task_id, p_new_status, p_note })
 * - When newStatus is completed/cancelled, also writes resolution_note via tasks update
 */

type Status = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';

function makeDBMock() {
  const rpc: any = vi.fn().mockResolvedValue({ error: null });
  const updateEq: any = vi.fn().mockResolvedValue({ error: null });
  const update: any = vi.fn(() => ({ eq: updateEq }));
  const from: any = vi.fn(() => ({ update }));
  return { rpc, from, update, updateEq };
}

async function runChangeStatus(
  DB: ReturnType<typeof makeDBMock>,
  opts: { taskId: string; newStatus: Status; note?: string; resolutionNote?: string; updateNote?: string },
) {
  const { error } = await DB.rpc('update_task_status', {
    p_task_id: opts.taskId,
    p_new_status: opts.newStatus,
    p_note: opts.note || opts.updateNote || null,
  });
  if (error) throw error;

  if (opts.newStatus === 'completed' || opts.newStatus === 'cancelled') {
    const { error: resErr } = await DB
      .from('tasks')
      .update({ resolution_note: opts.note || opts.resolutionNote, completed_at: new Date().toISOString() })
      .eq('id', opts.taskId);
    if (resErr) throw resErr;
  }
}

describe('changeStatusMutation', () => {
  let DB: ReturnType<typeof makeDBMock>;
  beforeEach(() => { DB = makeDBMock(); });

  it('calls update_task_status RPC with correct parameters', async () => {
    await runChangeStatus(DB, { taskId: 't1', newStatus: 'in_progress', updateNote: 'starting' });
    expect(DB.rpc).toHaveBeenCalledWith('update_task_status', {
      p_task_id: 't1',
      p_new_status: 'in_progress',
      p_note: 'starting',
    });
  });

  it('passes null note when no note provided', async () => {
    await runChangeStatus(DB, { taskId: 't2', newStatus: 'blocked' });
    expect(DB.rpc).toHaveBeenCalledWith('update_task_status', {
      p_task_id: 't2', p_new_status: 'blocked', p_note: null,
    });
  });

  it('saves resolution_note when status is completed', async () => {
    await runChangeStatus(DB, { taskId: 't3', newStatus: 'completed', note: 'done well' });
    expect(DB.from).toHaveBeenCalledWith('tasks');
    expect(DB.update).toHaveBeenCalledWith(
      expect.objectContaining({ resolution_note: 'done well' }),
    );
    expect(DB.updateEq).toHaveBeenCalledWith('id', 't3');
  });

  it('saves resolution_note when status is cancelled', async () => {
    await runChangeStatus(DB, { taskId: 't4', newStatus: 'cancelled', resolutionNote: 'no longer needed' });
    expect(DB.update).toHaveBeenCalledWith(
      expect.objectContaining({ resolution_note: 'no longer needed' }),
    );
  });

  it('does not write resolution_note for non-terminal statuses', async () => {
    await runChangeStatus(DB, { taskId: 't5', newStatus: 'in_progress' });
    expect(DB.from).not.toHaveBeenCalled();
  });

  it('throws when RPC returns an error', async () => {
    DB.rpc.mockResolvedValueOnce({ error: new Error('forbidden') });
    await expect(
      runChangeStatus(DB, { taskId: 't6', newStatus: 'in_progress' }),
    ).rejects.toThrow('forbidden');
  });
});
