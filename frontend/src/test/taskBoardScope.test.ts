import { describe, it, expect } from 'vitest';
import { isOnMyBoard, scopeTasksToMyBoard } from '@/lib/taskBoardScope';

const me = 'user-me';
const other = 'user-other';
const myGroups = new Set(['g-mine']);

const publicTask = { is_private: false, task_group_id: null, owner_id: other, assigned_by: other };
const othersPrivate = { is_private: true, task_group_id: null, owner_id: other, assigned_by: other };
const myPrivate = { is_private: true, task_group_id: null, owner_id: me, assigned_by: other };
const iCreatedPrivate = { is_private: true, task_group_id: null, owner_id: other, assigned_by: me };
const groupTaskMine = { is_private: false, task_group_id: 'g-mine', owner_id: other, assigned_by: other };
const groupTaskOther = { is_private: false, task_group_id: 'g-other', owner_id: other, assigned_by: other };
const groupTaskOtherIOwn = { is_private: false, task_group_id: 'g-other', owner_id: me, assigned_by: other };

describe('isOnMyBoard', () => {
  it('public task → visible to everyone', () => {
    expect(isOnMyBoard(publicTask, me, myGroups)).toBe(true);
    expect(isOnMyBoard(publicTask, 'anyone', new Set())).toBe(true);
  });

  it("another user's private task → hidden", () => {
    expect(isOnMyBoard(othersPrivate, me, myGroups)).toBe(false);
  });

  it('private task I own → visible', () => {
    expect(isOnMyBoard(myPrivate, me, myGroups)).toBe(true);
  });

  it('private task I created → visible', () => {
    expect(isOnMyBoard(iCreatedPrivate, me, myGroups)).toBe(true);
  });

  it('group task for a group I belong to → visible', () => {
    expect(isOnMyBoard(groupTaskMine, me, myGroups)).toBe(true);
  });

  it("group task for a group I'm NOT in → hidden", () => {
    expect(isOnMyBoard(groupTaskOther, me, myGroups)).toBe(false);
  });

  it('group task in a group I’m not in but I own → visible', () => {
    expect(isOnMyBoard(groupTaskOtherIOwn, me, myGroups)).toBe(true);
  });

  it('no viewer → never visible', () => {
    expect(isOnMyBoard(publicTask, null, myGroups)).toBe(false);
  });

  it('admin/WM get the SAME scoped set (no role bypass here)', () => {
    // Same inputs as a normal user → same answer; scoping is uniform.
    expect(isOnMyBoard(othersPrivate, 'admin-id', new Set())).toBe(false);
    expect(isOnMyBoard(groupTaskOther, 'admin-id', new Set())).toBe(false);
    expect(isOnMyBoard(publicTask, 'admin-id', new Set())).toBe(true);
  });
});

describe('scopeTasksToMyBoard', () => {
  it('filters a mixed list down to the viewer scope', () => {
    const list = [publicTask, othersPrivate, myPrivate, groupTaskMine, groupTaskOther];
    const out = scopeTasksToMyBoard(list, me, myGroups);
    expect(out).toEqual([publicTask, myPrivate, groupTaskMine]);
  });

  it('null/undefined tasks → empty array', () => {
    expect(scopeTasksToMyBoard(null, me, myGroups)).toEqual([]);
    expect(scopeTasksToMyBoard(undefined, me, myGroups)).toEqual([]);
  });
});
