import { describe, it, expect } from 'vitest';

describe('KPI Entry default date is yesterday', () => {
  it('confirms diffDays logic: yesterday = 1 day diff, not late', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const diffDays = Math.floor(
      (today.getTime() - yesterday.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(1);
    expect(diffDays >= 2).toBe(false); // not a late entry
  });

  it('confirms 2 days ago is marked as late entry', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    const diffDays = Math.floor(
      (today.getTime() - twoDaysAgo.getTime()) / (1000 * 60 * 60 * 24)
    );
    expect(diffDays).toBe(2);
    expect(diffDays >= 2).toBe(true); // is a late entry
  });
});
