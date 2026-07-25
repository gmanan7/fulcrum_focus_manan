import { describe, it, expect } from 'vitest';
import { buildTaskPayload } from '@/lib/taskPayload';

const base = {
  title: 'Inspect press line',
  description: 'Quarterly check',
  departmentId: 'dept-1',
  ownerId: 'user-A',
  assignedBy: 'user-B',
  createdBy: 'user-B',
  priority: 'medium' as const,
  dueDate: '2026-05-01',
};

describe('buildTaskPayload', () => {
  it("sets origin_type='meeting' when meetingId is provided", () => {
    const p = buildTaskPayload({ ...base, meetingId: 'meet-1' });
    expect(p.origin_type).toBe('meeting');
  });

  it('sets origin_meeting_id to the provided meeting id', () => {
    const p = buildTaskPayload({ ...base, meetingId: 'meet-1' });
    expect(p.origin_meeting_id).toBe('meet-1');
  });

  it("sets origin_type='standalone' when no meetingId", () => {
    const p = buildTaskPayload({ ...base });
    expect(p.origin_type).toBe('standalone');
    expect(p.origin_meeting_id).toBeNull();
  });

  it('sets origin_meeting_id to null when meetingId is empty string', () => {
    const p = buildTaskPayload({ ...base, meetingId: '' });
    expect(p.origin_type).toBe('standalone');
    expect(p.origin_meeting_id).toBeNull();
  });

  it('preserves all user-entered fields', () => {
    const p = buildTaskPayload({ ...base, meetingId: 'meet-9' });
    expect(p.title).toBe('Inspect press line');
    expect(p.description).toBe('Quarterly check');
    expect(p.department_id).toBe('dept-1');
    expect(p.owner_id).toBe('user-A');
    expect(p.assigned_by).toBe('user-B');
    expect(p.created_by).toBe('user-B');
    expect(p.priority).toBe('medium');
    expect(p.due_date).toBe('2026-05-01');
  });

  it('coerces empty description to null', () => {
    const p = buildTaskPayload({ ...base, description: '' });
    expect(p.description).toBeNull();
  });
});

describe('meeting tasks list refresh', () => {
  // Documents the contract that the Meeting Workspace tasks list filters by
  // origin_meeting_id, so a freshly inserted task with the matching meeting
  // id will appear after the ['meeting-tasks'] query is invalidated.
  it('payload built for meeting context matches the list filter key', () => {
    const meetingId = 'meet-42';
    const payload = buildTaskPayload({ ...base, meetingId });
    const wouldAppearInList = payload.origin_meeting_id === meetingId;
    expect(wouldAppearInList).toBe(true);
  });
});
