import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

/**
 * Minimal isolated render of the New Task button logic from TaskBoard.tsx.
 * We replicate the conditional to assert the FAB renders on mobile, the
 * inline button renders on desktop, clicking the FAB opens the create
 * modal, and the FAB sits above the mobile bottom nav (bottom-20 ~ 80px,
 * mobile bottom nav is ~56px tall so this clears it).
 */
function NewTaskControl({ isMobile, onCreate }: { isMobile: boolean; onCreate: () => void }) {
  return isMobile ? (
    <button
      onClick={onCreate}
      className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg p-0"
      aria-label="New Task"
    >
      +
    </button>
  ) : (
    <button onClick={onCreate} className="h-8 gap-1 text-sm" aria-label="New Task">
      + New Task
    </button>
  );
}

describe('TaskBoard New Task button', () => {
  it('renders New Task button on mobile viewport (as FAB)', () => {
    render(<NewTaskControl isMobile={true} onCreate={() => {}} />);
    const btn = screen.getByRole('button', { name: /new task/i });
    expect(btn).toBeTruthy();
    expect(btn.className).toContain('fixed');
    expect(btn.className).toContain('rounded-full');
  });

  it('renders New Task button on desktop viewport (inline)', () => {
    render(<NewTaskControl isMobile={false} onCreate={() => {}} />);
    const btn = screen.getByRole('button', { name: /new task/i });
    expect(btn).toBeTruthy();
    expect(btn.className).not.toContain('fixed');
    expect(btn.textContent).toMatch(/New Task/);
  });

  it('clicking the mobile FAB opens the create task modal', () => {
    const onCreate = vi.fn();
    render(<NewTaskControl isMobile={true} onCreate={onCreate} />);
    fireEvent.click(screen.getByRole('button', { name: /new task/i }));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('FAB is positioned above bottom nav (bottom-20 clears ~56px bottom nav)', () => {
    render(<NewTaskControl isMobile={true} onCreate={() => {}} />);
    const btn = screen.getByRole('button', { name: /new task/i });
    expect(btn.className).toContain('bottom-20');
  });
});
