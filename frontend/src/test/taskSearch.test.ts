import { describe, it, expect } from 'vitest';
import { searchMatches, highlightSegments } from '@/lib/taskSearch';

const base = {
  task_number: 42,
  title: 'Fix conveyor belt motor',
  description: 'Replace bearings on line 3',
  owner: { full_name: 'Yarra Nethaji' },
  dept: { name: 'Boiler & Engineering' },
  resolution_note: null,
  group: { name: 'Maintenance Sprint' },
};

describe('searchMatches', () => {
  it('returns true for empty query', () => {
    expect(searchMatches(base, '')).toBe(true);
    expect(searchMatches(base, '   ')).toBe(true);
  });

  it('matches title substring case-insensitively', () => {
    expect(searchMatches(base, 'CONVEYOR')).toBe(true);
    expect(searchMatches(base, 'belt')).toBe(true);
  });

  it('matches owner full_name', () => {
    expect(searchMatches(base, 'nethaji')).toBe(true);
  });

  it('matches department name', () => {
    expect(searchMatches(base, 'boiler')).toBe(true);
  });

  it('matches resolution note', () => {
    expect(
      searchMatches({ ...base, resolution_note: 'Replaced bearings, OK now' }, 'replaced')
    ).toBe(true);
  });

  it('matches group name', () => {
    expect(searchMatches(base, 'sprint')).toBe(true);
  });

  it('matches task_number with and without leading #', () => {
    expect(searchMatches(base, '42')).toBe(true);
    expect(searchMatches(base, '#42')).toBe(true);
    expect(searchMatches(base, '#43')).toBe(false);
  });

  it('returns false when nothing matches', () => {
    expect(searchMatches(base, 'zzznotfound')).toBe(false);
  });

  it('handles null / missing fields without throwing', () => {
    expect(searchMatches({ task_number: 1, title: null }, 'foo')).toBe(false);
    expect(searchMatches({}, 'foo')).toBe(false);
  });
});

describe('highlightSegments', () => {
  it('returns single non-match for empty query', () => {
    expect(highlightSegments('Hello World', '')).toEqual([
      { text: 'Hello World', match: false },
    ]);
  });

  it('splits and flags matched substrings', () => {
    const segs = highlightSegments('Fix conveyor belt', 'belt');
    expect(segs).toEqual([
      { text: 'Fix conveyor ', match: false },
      { text: 'belt', match: true },
    ]);
  });

  it('is case-insensitive but preserves original casing', () => {
    const segs = highlightSegments('CONVEYOR motor', 'conveyor');
    expect(segs[0]).toEqual({ text: 'CONVEYOR', match: true });
  });

  it('handles null text', () => {
    expect(highlightSegments(null, 'x')).toEqual([{ text: '', match: false }]);
  });
});
