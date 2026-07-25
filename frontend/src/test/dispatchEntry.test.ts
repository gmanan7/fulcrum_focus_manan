import { describe, it, expect } from 'vitest';
import { getMaxEntryDate, showTodayWarning } from '@/lib/dispatchEntry';

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const NOW = new Date('2026-04-21T10:00:00');
const TODAY = startOfDay(NOW);
const YESTERDAY = (() => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - 1);
  return d;
})();

describe('getMaxEntryDate', () => {
  it("returns today for ['DISP']", () => {
    expect(getMaxEntryDate(['DISP'], NOW).getTime()).toBe(TODAY.getTime());
  });
  it("returns yesterday for ['SFM']", () => {
    expect(getMaxEntryDate(['SFM'], NOW).getTime()).toBe(YESTERDAY.getTime());
  });
  it("returns today for ['DISP','QSFM']", () => {
    expect(getMaxEntryDate(['DISP', 'QSFM'], NOW).getTime()).toBe(TODAY.getTime());
  });
  it('returns yesterday for empty array', () => {
    expect(getMaxEntryDate([], NOW).getTime()).toBe(YESTERDAY.getTime());
  });
  it('returns yesterday for null', () => {
    expect(getMaxEntryDate(null, NOW).getTime()).toBe(YESTERDAY.getTime());
  });
  it('returns yesterday for undefined', () => {
    expect(getMaxEntryDate(undefined, NOW).getTime()).toBe(YESTERDAY.getTime());
  });
});

describe('showTodayWarning', () => {
  it('true when today selected and Dispatch user', () => {
    expect(showTodayWarning(TODAY, ['DISP'], NOW)).toBe(true);
  });
  it('false when yesterday selected and Dispatch user', () => {
    expect(showTodayWarning(YESTERDAY, ['DISP'], NOW)).toBe(false);
  });
  it('false when today selected but non-Dispatch user', () => {
    expect(showTodayWarning(TODAY, ['SFM'], NOW)).toBe(false);
  });
  it('false when no departments', () => {
    expect(showTodayWarning(TODAY, null, NOW)).toBe(false);
  });
});
