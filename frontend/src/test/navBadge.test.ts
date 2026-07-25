import { describe, it, expect } from 'vitest';
import { formatBadgeCount } from '@/lib/navBadge';

describe('formatBadgeCount', () => {
  it('returns null for 0', () => {
    expect(formatBadgeCount(0)).toBeNull();
  });
  it('returns null for negative', () => {
    expect(formatBadgeCount(-3)).toBeNull();
  });
  it('returns "5" for 5', () => {
    expect(formatBadgeCount(5)).toBe('5');
  });
  it('returns "99" for 99', () => {
    expect(formatBadgeCount(99)).toBe('99');
  });
  it('returns "99+" for 100', () => {
    expect(formatBadgeCount(100)).toBe('99+');
  });
  it('returns "99+" for 999', () => {
    expect(formatBadgeCount(999)).toBe('99+');
  });
});
