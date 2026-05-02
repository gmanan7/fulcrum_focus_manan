import { describe, it, expect } from 'vitest';
import {
  canAccessTaskOverview,
  getVisibilityKind,
  matchesVisibilityFilter,
} from '@/lib/taskOverview';

describe('canAccessTaskOverview', () => {
  it('allows super_admin', () => {
    expect(canAccessTaskOverview(['super_admin'])).toBe(true);
  });
  it('allows factory_manager', () => {
    expect(canAccessTaskOverview(['factory_manager'])).toBe(true);
  });
  it('blocks department_head', () => {
    expect(canAccessTaskOverview(['department_head'])).toBe(false);
  });
  it('blocks team_member', () => {
    expect(canAccessTaskOverview(['team_member'])).toBe(false);
  });
  it('blocks shop_floor', () => {
    expect(canAccessTaskOverview(['shop_floor'])).toBe(false);
  });
  it('blocks task_only', () => {
    expect(canAccessTaskOverview(['task_only'])).toBe(false);
  });
  it('blocks empty roles', () => {
    expect(canAccessTaskOverview([])).toBe(false);
  });
  it('allows when one of multiple roles is admin', () => {
    expect(canAccessTaskOverview(['team_member', 'factory_manager'])).toBe(true);
  });
});

describe('getVisibilityKind', () => {
  it('private when is_private=true', () => {
    expect(getVisibilityKind({ is_private: true, task_group_id: null })).toBe('private');
  });
  it('group when task_group_id set and not private', () => {
    expect(getVisibilityKind({ is_private: false, task_group_id: 'g1' })).toBe('group');
  });
  it('public otherwise', () => {
    expect(getVisibilityKind({ is_private: false, task_group_id: null })).toBe('public');
  });
  it('private wins over group', () => {
    expect(getVisibilityKind({ is_private: true, task_group_id: 'g1' })).toBe('private');
  });
  it('handles null/undefined', () => {
    expect(getVisibilityKind(null)).toBe('public');
    expect(getVisibilityKind(undefined)).toBe('public');
  });
});

describe('matchesVisibilityFilter', () => {
  const pub = { is_private: false, task_group_id: null };
  const priv = { is_private: true, task_group_id: null };
  const grp = { is_private: false, task_group_id: 'g1' };

  it('all matches everything', () => {
    expect(matchesVisibilityFilter(pub, 'all')).toBe(true);
    expect(matchesVisibilityFilter(priv, 'all')).toBe(true);
    expect(matchesVisibilityFilter(grp, 'all')).toBe(true);
  });
  it('public only', () => {
    expect(matchesVisibilityFilter(pub, 'public')).toBe(true);
    expect(matchesVisibilityFilter(priv, 'public')).toBe(false);
    expect(matchesVisibilityFilter(grp, 'public')).toBe(false);
  });
  it('private only', () => {
    expect(matchesVisibilityFilter(priv, 'private')).toBe(true);
    expect(matchesVisibilityFilter(pub, 'private')).toBe(false);
  });
  it('group only', () => {
    expect(matchesVisibilityFilter(grp, 'group')).toBe(true);
    expect(matchesVisibilityFilter(pub, 'group')).toBe(false);
    expect(matchesVisibilityFilter(priv, 'group')).toBe(false);
  });
});

// Sanity check that the read-only drawer renders no write controls.
// We assert on the source of the drawer file because rendering the React
// tree here would require pulling in all of its UI deps.
describe('TaskOverviewDrawer source contains no write controls', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  const src = fs.readFileSync(
    require('path').resolve(__dirname, '../components/tasks/TaskOverviewDrawer.tsx'),
    'utf8',
  );

  it('contains no <Textarea (no comment input)', () => {
    expect(src.includes('<Textarea')).toBe(false);
  });
  it('contains no status update mutation call', () => {
    expect(/onClick=\{[^}]*updateStatus|mutateAsync\(|\.update\(/.test(src)).toBe(false);
  });
  it('does not render an Edit Task button', () => {
    expect(/Edit Task|Change Due Date/i.test(src)).toBe(false);
  });
  it('does not render a Send / Save / Submit button', () => {
    expect(/<Button[^>]*>\s*(Send|Save|Submit|Update)/.test(src)).toBe(false);
  });
});
