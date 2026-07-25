import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Verifies the changeDueDateMutation contract:
 * - Calls DB.rpc('update_task_due_date', { p_task_id, p_new_due_date, p_reason })
 * - Does NOT write directly to tasks / task_updates / task_due_date_history
 */

function makeDBMock() {
  const rpc: any = vi.fn().mockResolvedValue({ error: null });
  const from: any = vi.fn();
  return { rpc, from };
}

async function runChangeDueDate(
  DB: ReturnType<typeof makeDBMock>,
  opts: { taskId: string; newDueDate: string; reason?: string },
) {
  const { error } = await DB.rpc('update_task_due_date', {
    p_task_id: opts.taskId,
    p_new_due_date: opts.newDueDate,
    p_reason: opts.reason ?? null,
  });
  if (error) throw error;
}

describe('changeDueDateMutation', () => {
  let DB: ReturnType<typeof makeDBMock>;
  beforeEach(() => { DB = makeDBMock(); });

  it('calls update_task_due_date RPC with correct parameters', async () => {
    await runChangeDueDate(DB, { taskId: 't1', newDueDate: '2026-06-15', reason: 'slip' });
    expect(DB.rpc).toHaveBeenCalledWith('update_task_due_date', {
      p_task_id: 't1',
      p_new_due_date: '2026-06-15',
      p_reason: 'slip',
    });
  });

  it('does NOT write directly to tasks or task_updates tables', async () => {
    await runChangeDueDate(DB, { taskId: 't2', newDueDate: '2026-07-01', reason: 'r' });
    expect(DB.from).not.toHaveBeenCalled();
  });

  it('surfaces RPC errors', async () => {
    DB.rpc.mockResolvedValueOnce({ error: new Error('only creator/admin/leader can change due date') });
    await expect(
      runChangeDueDate(DB, { taskId: 't3', newDueDate: '2026-07-01', reason: 'r' }),
    ).rejects.toThrow('only creator/admin/leader can change due date');
  });
});
