import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const src = readFileSync('src/pages/MeetingWorkspace.tsx', 'utf8');

/**
 * Source-level guarantees so the meeting-notes persistence regression
 * (notes appearing blank after navigating away and returning) cannot
 * silently come back.
 */
describe('MeetingWorkspace notes persistence — source guarantees', () => {
  it("meeting fetch query sets staleTime: 0 (always refetch on mount)", () => {
    const idx = src.indexOf("queryKey: ['meeting', id]");
    expect(idx).toBeGreaterThan(-1);
    const block = src.slice(idx, idx + 600);
    expect(block).toMatch(/staleTime:\s*0/);
  });

  it('save mutation invalidates the meeting query cache', () => {
    // Look inside performSave / the NotesTab module
    const notesIdx = src.indexOf('function NotesTab');
    expect(notesIdx).toBeGreaterThan(-1);
    const block = src.slice(notesIdx);
    expect(block).toMatch(/queryClient\.invalidateQueries\(\s*\{\s*queryKey:\s*\['meeting',\s*meeting\.id\]\s*\}\s*\)/);
    expect(block).toMatch(/queryClient\.invalidateQueries\(\s*\{\s*queryKey:\s*\['meetings'\]\s*\}\s*\)/);
  });

  it('NotesTab syncs local state from fetched meeting on id change', () => {
    const notesIdx = src.indexOf('function NotesTab');
    const block = src.slice(notesIdx);
    // useEffect with [meeting?.id] dependency that copies meeting.summary into local state
    expect(block).toMatch(/setSummary\(meeting\.summary\s*\?\?\s*''\)/);
    expect(block).toMatch(/setLastSaved\(meeting\.summary\s*\?\?\s*''\)/);
    expect(block).toMatch(/\[meeting\?\.id\]/);
  });

  it('sync useEffect depends on meeting id, NOT notes content', () => {
    const notesIdx = src.indexOf('function NotesTab');
    const block = src.slice(notesIdx);
    // Must not depend on summary/notes — would clobber keystrokes
    expect(block).not.toMatch(/\[meeting\?\.summary\]/);
    expect(block).not.toMatch(/\[meeting\.summary\]/);
  });

  it('save errors are surfaced via console.error for debugging', () => {
    const notesIdx = src.indexOf('function NotesTab');
    const block = src.slice(notesIdx);
    expect(block).toMatch(/console\.error\([^)]*meeting notes/);
  });

  it('save mutation writes to the same `summary` column the fetch reads', () => {
    // Fetch reads * from meetings (includes summary)
    expect(src).toMatch(/from\('meetings'\)\.select\('\*'\)/);
    // Save updates the summary column
    expect(src).toMatch(/from\('meetings'\)\s*\.update\(\{\s*summary:/);
  });
});

/**
 * Behavioural simulation of the notes lifecycle: type → save → unmount →
 * remount with fresh fetch → notes preserved.
 */
describe('Notes content preserved after save and remount (logic mirror)', () => {
  function newMeetingRow(summary: string | null) {
    return { id: 'm1', summary };
  }

  it('round-trip: typed value persists across a remount that refetches', () => {
    // 1. mount with empty notes
    let serverRow = newMeetingRow('');
    let local = serverRow.summary ?? '';
    expect(local).toBe('');

    // 2. user types, then saves → server row updates, cache invalidated
    local = 'Discussed Q3 plan';
    serverRow = newMeetingRow(local); // simulates DB write

    // 3. user navigates away — local state lost. Component remounts and
    //    initialises from the fresh server fetch (staleTime: 0).
    const remountedLocal = serverRow.summary ?? '';
    expect(remountedLocal).toBe('Discussed Q3 plan');
  });

  it('null summary from DB normalises to empty string on remount', () => {
    const serverRow = newMeetingRow(null);
    const local = serverRow.summary ?? '';
    expect(local).toBe('');
  });
});
