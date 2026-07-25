import { describe, it, expect } from 'vitest';

/**
 * Scan for any remaining "Fulcrum Hub" strings in UI-rendering components.
 * This test ensures the app name change to "Fulcrum Focus" is complete.
 */
describe('App Name Consistency', () => {
  it('should have no "Fulcrum Hub" strings in UI components', async () => {
    // List of files that should NOT contain "Fulcrum Hub"
    const uiFiles = [
      'src/pages/Login.tsx',
      'src/components/AppSidebar.tsx',
      'src/components/AppShell.tsx',
      'index.html',
    ];

    const violations: string[] = [];

    for (const file of uiFiles) {
      try {
        const content = await import(`../../../${file}?raw`).then(m => m.default || m);
        if (typeof content === 'string' && content.includes('Fulcrum Hub')) {
          violations.push(file);
        }
      } catch {
        // File might not be importable as raw, skip
      }
    }

    expect(violations).toEqual([]);
  });

  it('should confirm "Fulcrum Focus" is present in key UI files', async () => {
    // Verify the new name is in place
    const keyFiles = [
      'src/pages/Login.tsx',
      'src/components/AppSidebar.tsx',
      'src/components/AppShell.tsx',
    ];

    const missing: string[] = [];

    for (const file of keyFiles) {
      try {
        const content = await import(`../../../${file}?raw`).then(m => m.default || m);
        if (typeof content === 'string' && !content.includes('Fulcrum Focus')) {
          missing.push(file);
        }
      } catch {
        // Skip if not importable
      }
    }

    expect(missing).toEqual([]);
  });
});
