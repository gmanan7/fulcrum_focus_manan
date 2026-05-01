import { describe, it, expect } from 'vitest';
import { canViewTask, DEFAULT_TASK_IS_PRIVATE } from '@/lib/taskPrivacy';

const privateTask = {
  is_private: true,
  assigned_by: 'creator-1',
  owner_id: 'assignee-1',
};

const publicTask = {
  is_private: false,
  assigned_by: 'creator-1',
  owner_id: 'assignee-1',
};

describe('canViewTask — private task visibility', () => {
  it('private task visible to creator → true', () => {
    expect(canViewTask(privateTask, 'creator-1', ['team_member'])).toBe(true);
  });

  it('private task visible to assignee → true', () => {
    expect(canViewTask(privateTask, 'assignee-1', ['team_member'])).toBe(true);
  });

  it('private task visible to super_admin → true', () => {
    expect(canViewTask(privateTask, 'admin-9', ['super_admin'])).toBe(true);
  });

  it('private task visible to factory_manager → true', () => {
    expect(canViewTask(privateTask, 'fm-9', ['factory_manager'])).toBe(true);
  });

  it('private task NOT visible to unrelated user → false', () => {
    expect(canViewTask(privateTask, 'someone-else', ['team_member'])).toBe(false);
  });

  it('private task NOT visible when not authenticated → false', () => {
    expect(canViewTask(privateTask, null, [])).toBe(false);
  });
});

describe('canViewTask — public task visibility', () => {
  it('public task visible to all authenticated users → true', () => {
    expect(canViewTask(publicTask, 'anyone', [])).toBe(true);
    expect(canViewTask(publicTask, 'creator-1', [])).toBe(true);
    expect(canViewTask(publicTask, 'assignee-1', [])).toBe(true);
  });

  it('public task NOT visible to unauthenticated viewer → false', () => {
    expect(canViewTask(publicTask, null, [])).toBe(false);
  });
});

describe('default is_private value', () => {
  it('is_private defaults to false on new tasks → true', () => {
    expect(DEFAULT_TASK_IS_PRIVATE).toBe(false);
  });
});
