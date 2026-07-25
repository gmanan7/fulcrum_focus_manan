import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { canManageLeaders, sortMembersLeadersFirst } from '@/lib/taskGroups';

const group = { id: 'g1', created_by: 'creator-1' };

describe('canManageLeaders', () => {
  it('super_admin can manage leaders', () => {
    expect(canManageLeaders(group, 'u', ['super_admin'])).toBe(true);
  });
  it('factory_manager can manage leaders', () => {
    expect(canManageLeaders(group, 'u', ['factory_manager'])).toBe(true);
  });
  it('creator can manage leaders', () => {
    expect(canManageLeaders(group, 'creator-1', ['team_member'])).toBe(true);
  });
  it('department_head who did not create cannot manage leaders', () => {
    expect(canManageLeaders(group, 'other-hod', ['department_head'])).toBe(false);
  });
  it('regular team member cannot manage leaders', () => {
    expect(canManageLeaders(group, 'u', ['team_member'])).toBe(false);
  });
  it('a group leader (non-creator) cannot promote others', () => {
    // Leadership is stored on task_group_members; canManageLeaders ignores it
    // because only admin/WM/creator may manage.
    expect(canManageLeaders(group, 'some-leader', ['team_member'])).toBe(false);
  });
  it('unauthenticated cannot manage', () => {
    expect(canManageLeaders(group, null, ['super_admin'])).toBe(false);
  });
});

describe('sortMembersLeadersFirst', () => {
  const a = { user_id: 'a', is_leader: false, profile: { full_name: 'Alice' } };
  const b = { user_id: 'b', is_leader: true, profile: { full_name: 'Bob' } };
  const c = { user_id: 'c', is_leader: false, profile: { full_name: 'Carol' } };
  const d = { user_id: 'd', is_leader: true, profile: { full_name: 'Anna' } };

  it('leaders come before non-leaders', () => {
    const out = sortMembersLeadersFirst([a, b, c, d]);
    expect(out.slice(0, 2).every((m) => m.is_leader)).toBe(true);
    expect(out.slice(2).every((m) => !m.is_leader)).toBe(true);
  });

  it('alphabetical within each group', () => {
    const out = sortMembersLeadersFirst([a, b, c, d]);
    expect(out.map((m) => m.user_id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('supports multiple leaders', () => {
    const out = sortMembersLeadersFirst([a, b, d]);
    expect(out.filter((m) => m.is_leader)).toHaveLength(2);
  });

  it('handles missing profile names', () => {
    const x = { user_id: 'x', is_leader: false, profile: null };
    const y = { user_id: 'y', is_leader: true, profile: null };
    const out = sortMembersLeadersFirst([x, y]);
    expect(out[0].user_id).toBe('y');
  });
});

describe('GroupsPanel leader UI source-level guarantees', () => {
  const src = readFileSync('src/components/tasks/GroupsPanel.tsx', 'utf8');

  it('renders a Leader badge when is_leader is true', () => {
    expect(src).toMatch(/m\.is_leader && \(/);
    expect(src).toMatch(/Leader/);
  });

  it('uses canManageLeaders to gate the make/remove-leader control', () => {
    expect(src).toMatch(/canLead/);
    expect(src).toMatch(/canManageLeaders\(/);
  });

  it('toggles is_leader via task_group_members update', () => {
    expect(src).toMatch(/from\('task_group_members' as any\)\s*\.update\(\{ is_leader/);
    expect(src).toMatch(/\.eq\('group_id', groupId\)/);
    expect(src).toMatch(/\.eq\('user_id', memberUserId\)/);
  });

  it('selects is_leader when fetching members', () => {
    expect(src).toMatch(/is_leader/);
    expect(src).toMatch(/select\('id, user_id, added_by, created_at, is_leader'\)/);
  });

  it('sorts members with sortMembersLeadersFirst', () => {
    expect(src).toMatch(/sortMembersLeadersFirst\(/);
  });

  it('flags an RLS hint in the error toast', () => {
    expect(src).toMatch(/RLS UPDATE policy on task_group_members/);
  });
});
