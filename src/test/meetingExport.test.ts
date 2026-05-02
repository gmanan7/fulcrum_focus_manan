import { describe, it, expect } from 'vitest';
import {
  buildAttendanceRows,
  buildKpiRows,
  buildTaskRows,
  countAttendance,
  sanitiseMeetingTitle,
  generateMeetingFilename,
  formatDuration,
  defaultSectionSelections,
  chosenFormats,
  MEETING_EXPORT_SECTIONS,
} from '@/lib/meetingExport';

describe('sanitiseMeetingTitle', () => {
  it('replaces special chars with underscores', () => {
    expect(sanitiseMeetingTitle('T4 Review: Apr/2026')).toBe('T4_Review_Apr_2026');
  });
  it('collapses multiple separators', () => {
    expect(sanitiseMeetingTitle('Hello   --   World!!')).toBe('Hello_World');
  });
  it('falls back to "meeting" for empty input', () => {
    expect(sanitiseMeetingTitle('')).toBe('meeting');
  });
});

describe('generateMeetingFilename', () => {
  it('builds pdf filename', () => {
    expect(generateMeetingFilename('2026-04-23', 'T4 Review: Apr/2026', 'pdf'))
      .toBe('Meeting_2026-04-23_T4_Review_Apr_2026.pdf');
  });
  it('builds xlsx filename with _Data suffix', () => {
    expect(generateMeetingFilename('2026-04-23', 'Daily Standup', 'xlsx'))
      .toBe('Meeting_2026-04-23_Daily_Standup_Data.xlsx');
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    expect(formatDuration('2026-04-23T09:00:00Z', '2026-04-23T10:30:00Z')).toBe('1 hour 30 minutes');
  });
  it('shows only minutes when under an hour', () => {
    expect(formatDuration('2026-04-23T09:00:00Z', '2026-04-23T09:45:00Z')).toBe('45 minutes');
  });
  it('returns empty when missing values', () => {
    expect(formatDuration(null, null)).toBe('');
  });
});

describe('buildAttendanceRows', () => {
  const sample = [
    {
      id: 'i1',
      is_mandatory: true,
      profile: { full_name: 'Marut' },
      dept: { name: 'Production' },
      attendance: [{ status: 'present', remarks: null }],
    },
    {
      id: 'i2',
      is_mandatory: false,
      profile: { full_name: 'Binoy' },
      dept: { name: 'Quality' },
      attendance: [{ status: 'absent', remarks: 'Sick' }],
    },
    {
      id: 'i3',
      is_mandatory: false,
      guest_name: 'Guest User',
      guest_designation: 'Auditor',
      attendance: [],
    },
  ];

  it('maps profile, guest fallback, mandatory flag, status display', () => {
    const rows = buildAttendanceRows(sample as any);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      Name: 'Marut',
      Department: 'Production',
      Designation: '—',
      Mandatory: 'Yes',
      Status: 'Present ✓',
      Remarks: '—',
    });
    expect(rows[1].Name).toBe('Binoy');
    expect(rows[1].Status).toBe('Absent');
    expect(rows[1].Remarks).toBe('Sick');
    expect(rows[2].Name).toBe('Guest User');
    expect(rows[2].Status).toBe('Not Marked');
    expect(rows[2].Designation).toBe('Auditor');
  });

  it('handles empty array', () => {
    expect(buildAttendanceRows([])).toEqual([]);
  });

  it('handles null/undefined invitees', () => {
    expect(buildAttendanceRows(null as any)).toEqual([]);
    expect(buildAttendanceRows(undefined as any)).toEqual([]);
  });

  it('counts attendance correctly', () => {
    const counts = countAttendance(sample as any);
    expect(counts.totalInvited).toBe(3);
    expect(counts.totalPresent).toBe(1);
    expect(counts.totalAbsent).toBe(1);
    expect(counts.totalExcused).toBe(0);
  });

  it('countAttendance handles null', () => {
    expect(countAttendance(null as any)).toEqual({
      totalInvited: 0, totalPresent: 0, totalAbsent: 0, totalExcused: 0,
    });
  });
});

describe('buildKpiRows', () => {
  it('maps department, kpi, unit, target, values, status', () => {
    const rows = buildKpiRows([
      {
        id: 'k1',
        name: 'Output',
        unit: 'Mn HLP',
        target_value: 100,
        department: { name: 'Production' },
        yesterday_value: 95,
        mtd_value: 90,
        status: 'amber',
      },
    ]);
    expect(rows).toEqual([
      {
        Department: 'Production',
        'KPI Name': 'Output',
        Unit: 'Mn HLP',
        Target: 100,
        'Yesterday Value': 95,
        'MTD Value': 90,
        Status: 'AMBER',
      },
    ]);
  });
});

describe('buildTaskRows', () => {
  it('maps title, owner, due date, status, priority, creator', () => {
    const rows = buildTaskRows([
      {
        id: 't1',
        title: 'Fix line 3',
        status: 'in_progress',
        priority: 'high',
        due_date: '2026-04-25',
        owner: { full_name: 'Alice' },
        creator: { full_name: 'Bob' },
      },
    ]);
    expect(rows).toEqual([
      {
        'Task Title': 'Fix line 3',
        'Assigned To': 'Alice',
        'Due Date': '25/04/2026',
        Status: 'In Progress',
        Priority: 'High',
        'Created By': 'Bob',
      },
    ]);
  });
});

describe('section selection', () => {
  it('defaults all sections selected with documented formats', () => {
    const sel = defaultSectionSelections();
    expect(sel).toHaveLength(MEETING_EXPORT_SECTIONS.length);
    expect(sel.every((s) => s.selected)).toBe(true);
    const map = Object.fromEntries(sel.map((s) => [s.key, s.format]));
    expect(map.summary).toBe('pdf');
    expect(map.attendance).toBe('pdf');
    expect(map.kpi).toBe('xlsx');
    expect(map.notes).toBe('pdf');
    expect(map.decisions).toBe('pdf');
    expect(map.tasks).toBe('xlsx');
  });

  it('chosenFormats partitions sections by format', () => {
    const { pdf, xlsx } = chosenFormats(defaultSectionSelections());
    expect(pdf).toEqual(['summary', 'attendance', 'notes', 'decisions']);
    expect(xlsx).toEqual(['kpi', 'tasks']);
  });

  it('chosenFormats produces both groups when both formats selected', () => {
    const sel = defaultSectionSelections();
    const { pdf, xlsx } = chosenFormats(sel);
    expect(pdf.length).toBeGreaterThan(0);
    expect(xlsx.length).toBeGreaterThan(0);
  });

  it('chosenFormats skips unselected sections', () => {
    const sel = defaultSectionSelections().map((s) =>
      s.key === 'kpi' ? { ...s, selected: false } : s,
    );
    const { xlsx } = chosenFormats(sel);
    expect(xlsx).not.toContain('kpi');
  });
});
