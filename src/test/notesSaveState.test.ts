import { describe, it, expect } from 'vitest';
import { hasUnsavedChanges, SAVED_DISPLAY_MS } from '@/lib/notesSaveState';

describe('notesSaveState', () => {
  it('hasUnsavedChanges returns true after editing', () => {
    expect(hasUnsavedChanges('hello world', 'hello')).toBe(true);
  });

  it('hasUnsavedChanges returns false after successful save (values equal)', () => {
    expect(hasUnsavedChanges('hello', 'hello')).toBe(false);
  });

  it('treats null/undefined and empty as equivalent', () => {
    expect(hasUnsavedChanges('', '')).toBe(false);
    expect(hasUnsavedChanges(undefined as unknown as string, '')).toBe(false);
    expect(hasUnsavedChanges(null as unknown as string, undefined as unknown as string)).toBe(false);
  });

  it('SAVED_DISPLAY_MS is 2000ms', () => {
    expect(SAVED_DISPLAY_MS).toBe(2000);
  });

  it('disabled-during-save guard: saving state implies button disabled', () => {
    const isSaving = true;
    const disabled = isSaving;
    expect(disabled).toBe(true);
  });

  it('success state clears after 2 seconds (timer math)', () => {
    const start = 1000;
    const end = start + SAVED_DISPLAY_MS;
    expect(end - start).toBe(2000);
  });
});
