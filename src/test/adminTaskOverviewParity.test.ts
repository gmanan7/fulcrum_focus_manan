import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { searchMatches } from '@/lib/taskSearch';
import { sortTasks } from '@/lib/taskSort';
import { isTaskOverdue, isTaskDueToday } from '@/lib/utils';
import { isCarryover } from '@/lib/taskCarryover';
import { canAccessTaskOverview } from '@/lib/taskOverview';

/**
 * AdminTaskOverview parity with main board:
 *  - Calendar view, sort dropdown, search, chip filters
 *  - Read-only via TaskOverviewDrawer
 *  - No viewer scoping (shows ALL tasks)
 *  - Restricted to super_admin / factory_manager
 */
const SRC = readFileSync('src/pages/AdminTaskOverview.tsx', 'utf8');

describe('AdminTaskOverview — parity wiring', () => {
  it('imports the shared calendar component', () => {
    expect(SRC).toMatch(/from '@\/components\/tasks\/TaskCalendarView'/);
    expect(SRC).toMatch(/<TaskCalendarView/);
  });

  it('exposes a Calendar view toggle in addition to Kanban/Table', () => {
    expect(SRC).toMatch(/view === 'calendar'/);
    expect(SRC).toMatch(/onClick=\{\(\) => setView\('calendar'\)\}/);
  });

  it('uses shared searchMatches + sortTasks (not custom logic)', () => {
    expect(SRC).toMatch(/from '@\/lib\/taskSearch'/);
    expect(SRC).toMatch(/searchMatches\(t, search\)/);
    expect(SRC).toMatch(/from '@\/lib\/taskSort'/);
    expect(SRC).toMatch(/sortTasks\(filtered, sortKey\)/);
    expect(SRC).toMatch(/TASK_SORT_OPTIONS/);
  });

  it('wires chip filters (Overdue / Due Today / Carryover / My Tasks)', () => {
    expect(SRC).toMatch(/chipOverdue/);
    expect(SRC).toMatch(/chipDueToday/);
    expect(SRC).toMatch(/chipCarryover/);
    expect(SRC).toMatch(/chipMyTasks/);
    expect(SRC).toMatch(/isTaskOverdue\(t\)/);
    expect(SRC).toMatch(/isTaskDueToday\(t\)/);
    expect(SRC).toMatch(/isCarryover\(t, historyIds\)/);
  });

  it('opens the READ-ONLY TaskOverviewDrawer, NOT TaskDetailDrawer', () => {
    expect(SRC).toMatch(/<TaskOverviewDrawer/);
    expect(SRC).not.toMatch(/TaskDetailDrawer/);
  });

  it('does NOT viewer-scope the admin list (no isOnMyBoard / scopeTasksToMyBoard)', () => {
    expect(SRC).not.toMatch(/isOnMyBoard/);
    expect(SRC).not.toMatch(/scopeTasksToMyBoard/);
  });

  it('access is gated to admin/WM via canAccessTaskOverview + redirect', () => {
    expect(SRC).toMatch(/canAccessTaskOverview\(roles\)/);
    expect(SRC).toMatch(/Navigate to="\/dashboard" replace/);
    expect(canAccessTaskOverview(['super_admin'])).toBe(true);
    expect(canAccessTaskOverview(['factory_manager'])).toBe(true);
    expect(canAccessTaskOverview(['team_member'])).toBe(false);
    expect(canAccessTaskOverview(['department_head'])).toBe(false);
  });

  it('still queries ALL tasks (no owner/group filter at query level)', () => {
    // The select() call must not narrow by user — it fetches everything,
    // RLS lets admin/WM see private + group tasks too.
    expect(SRC).toMatch(/queryKey: \['admin-all-tasks'\]/);
    const selectBlock = SRC.match(/from\('tasks'\)\s*\.select\([\s\S]*?\)\s*\.order/);
    expect(selectBlock).toBeTruthy();
    expect(SRC).not.toMatch(/\.eq\('owner_id'/);
  });
});

describe('AdminTaskOverview — filter composition behaviour', () => {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const yesterday = iso(new Date(today.getTime() - 86400000));
  const todayStr = iso(today);
  const tomorrow = iso(new Date(today.getTime() + 86400000));

  const t1 = { id: 'a', title: 'Fix pump', status: 'open', priority: 'high', due_date: yesterday, owner_id: 'me', owner: { full_name: 'Alice' }, created_at: '2025-01-01' };
  const t2 = { id: 'b', title: 'Order parts', status: 'open', priority: 'low', due_date: todayStr, owner_id: 'other', owner: { full_name: 'Bob' }, created_at: '2025-02-01' };
  const t3 = { id: 'c', title: 'Future plan', status: 'open', priority: 'low', due_date: tomorrow, owner_id: 'other', owner: { full_name: 'Cara' }, created_at: '2025-03-01' };
  const t4 = { id: 'd', title: 'Done deal', status: 'completed', priority: 'low', due_date: yesterday, owner_id: 'me', owner: { full_name: 'Alice' }, created_at: '2025-01-15' };

  const list = [t1, t2, t3, t4];
  const historyIds = new Set(['a']); // t1 has been pushed → carryover

  it('search filters by title and owner', () => {
    expect(list.filter((t) => searchMatches(t, 'pump'))).toEqual([t1]);
    expect(list.filter((t) => searchMatches(t, 'Bob'))).toEqual([t2]);
  });

  it('overdue chip narrows to overdue tasks', () => {
    const out = list.filter(isTaskOverdue);
    expect(out.map((t) => t.id)).toEqual(['a']); // t4 is completed → not overdue
  });

  it('due-today chip narrows to today', () => {
    const out = list.filter(isTaskDueToday);
    expect(out.map((t) => t.id)).toEqual(['b']);
  });

  it('carryover chip uses historyIds', () => {
    const out = list.filter((t) => isCarryover(t, historyIds));
    expect(out.map((t) => t.id)).toContain('a');
  });

  it('my-tasks chip filters by owner_id', () => {
    const me = 'me';
    expect(list.filter((t) => t.owner_id === me).map((t) => t.id)).toEqual(['a', 'd']);
  });

  it('sort dropdown reorders (newest, oldest, due asc/desc)', () => {
    expect(sortTasks(list, 'created_desc').map((t) => t.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(sortTasks(list, 'created_asc').map((t) => t.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(sortTasks(list, 'due_asc').map((t) => t.id)[0]).toBe('a');
    expect(sortTasks(list, 'due_desc').map((t) => t.id)[0]).toBe('c');
  });

  it('filters compose with AND (search + overdue + dept)', () => {
    const me = 'me';
    const out = list
      .filter((t) => searchMatches(t, 'pump'))
      .filter(isTaskOverdue)
      .filter((t) => t.owner_id === me);
    expect(out).toEqual([t1]);
  });
});
