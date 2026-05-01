export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function hasUnsavedChanges(current: string, lastSaved: string): boolean {
  return (current ?? '') !== (lastSaved ?? '');
}

export const SAVED_DISPLAY_MS = 2000;
export const ERROR_DISPLAY_MS = 3000;
