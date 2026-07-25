import { format, differenceInSeconds } from 'date-fns';

/* ── Types ── */

export interface MeetingMeta {
  id: string;
  title: string;
  scheduled_date: string;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  actual_start?: string | null;
  actual_end?: string | null;
  status: string;
  facilitator_id?: string | null;
  summary?: string | null;
  auto_closed?: boolean | null;
}

export interface AttendanceRecord {
  status?: string | null;
  remarks?: string | null;
}

export interface InviteeWithAttendance {
  id: string;
  user_id?: string | null;
  guest_name?: string | null;
  guest_designation?: string | null;
  department_id?: string | null;
  is_mandatory?: boolean | null;
  profile?: { full_name?: string | null } | null;
  dept?: { name?: string | null } | null;
  attendance?: AttendanceRecord[] | null;
}

export interface KpiSnapshotInput {
  id: string;
  name: string;
  unit?: string | null;
  target_value?: number | null;
  department?: { name?: string | null } | null;
  yesterday_value?: number | null;
  mtd_value?: number | null;
  status?: string | null;
}

export interface MeetingTaskInput {
  id: string;
  title: string;
  status: string;
  priority?: string | null;
  due_date?: string | null;
  owner?: { full_name?: string | null } | null;
  creator?: { full_name?: string | null } | null;
}

/* ── Helpers ── */

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  scheduled: 'Scheduled',
  present: 'Present',
  absent: 'Absent',
  late: 'Late',
};

export function sanitiseMeetingTitle(title: string): string {
  if (!title) return 'meeting';
  return title
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function generateMeetingFilename(
  date: Date | string,
  title: string,
  ext: 'pdf' | 'xlsx',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const datePart = format(d, 'yyyy-MM-dd');
  const titlePart = sanitiseMeetingTitle(title);
  const suffix = ext === 'xlsx' ? '_Data.xlsx' : '.pdf';
  return `Meeting_${datePart}_${titlePart}${suffix}`;
}

export function formatDateDDMMYYYY(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'dd/MM/yyyy');
}

export function formatDuration(start?: string | null, end?: string | null): string {
  if (!start || !end) return '';
  const secs = differenceInSeconds(new Date(end), new Date(start));
  if (Number.isNaN(secs) || secs < 0) return '';
  const hours = Math.floor(secs / 3600);
  const minutes = Math.round((secs % 3600) / 60);
  if (hours === 0) return `${minutes} minutes`;
  return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} minutes`;
}

/* ── Row builders ── */

export interface AttendanceRow {
  Name: string;
  Department: string;
  Designation: string;
  Mandatory: string;
  Status: string;
  Remarks: string;
}

const ATTENDANCE_STATUS_DISPLAY: Record<string, string> = {
  present: 'Present ✓',
  absent: 'Absent',
  excused: 'Excused',
  not_marked: 'Not Marked',
};

export function attendanceStatusDisplay(status: string | null | undefined): string {
  const key = status ?? 'not_marked';
  return ATTENDANCE_STATUS_DISPLAY[key] ?? key;
}

export function buildAttendanceRows(
  invitees: InviteeWithAttendance[] | null | undefined,
): AttendanceRow[] {
  return (invitees ?? []).map((inv) => {
    const status = inv.attendance?.[0]?.status ?? 'not_marked';
    const remarks = inv.attendance?.[0]?.remarks ?? '—';
    return {
      Name: inv.profile?.full_name ?? inv.guest_name ?? 'Unknown',
      Department: inv.dept?.name ?? '—',
      Designation: inv.guest_designation ?? '—',
      Mandatory: inv.is_mandatory ? 'Yes' : 'No',
      Status: attendanceStatusDisplay(status),
      Remarks: remarks,
    };
  });
}

export function countAttendance(invitees: InviteeWithAttendance[] | null | undefined) {
  const list = invitees ?? [];
  const by = (s: string) => list.filter((i) => i.attendance?.[0]?.status === s).length;
  return {
    totalInvited: list.length,
    totalPresent: by('present'),
    totalAbsent: by('absent'),
    totalExcused: by('excused'),
  };
}

export interface KpiRow {
  Department: string;
  'KPI Name': string;
  Unit: string;
  Target: number | string;
  'Yesterday Value': number | string;
  'MTD Value': number | string;
  Status: string;
}

export function buildKpiRows(snapshot: KpiSnapshotInput[]): KpiRow[] {
  return (snapshot || []).map((k) => ({
    Department: k.department?.name ?? '',
    'KPI Name': k.name ?? '',
    Unit: k.unit ?? '',
    Target: k.target_value ?? '',
    'Yesterday Value': k.yesterday_value ?? '',
    'MTD Value': k.mtd_value ?? '',
    Status: k.status ? k.status.toUpperCase() : '',
  }));
}

export interface TaskRow {
  'Task Title': string;
  'Assigned To': string;
  'Due Date': string;
  Status: string;
  Priority: string;
  'Created By': string;
}

export function buildTaskRows(tasks: MeetingTaskInput[]): TaskRow[] {
  return (tasks || []).map((t) => ({
    'Task Title': t.title ?? '',
    'Assigned To': t.owner?.full_name ?? '',
    'Due Date': formatDateDDMMYYYY(t.due_date),
    Status: STATUS_LABELS[t.status] ?? t.status ?? '',
    Priority: t.priority ? t.priority.charAt(0).toUpperCase() + t.priority.slice(1) : '',
    'Created By': t.creator?.full_name ?? '',
  }));
}

/* ── Section selection state ── */

export type SectionKey =
  | 'summary'
  | 'attendance'
  | 'kpi'
  | 'notes'
  | 'decisions'
  | 'tasks';

export type SectionFormat = 'pdf' | 'xlsx';

export interface SectionConfig {
  key: SectionKey;
  label: string;
  defaultFormat: SectionFormat;
  allowedFormats: SectionFormat[];
}

export const MEETING_EXPORT_SECTIONS: SectionConfig[] = [
  { key: 'summary', label: 'Meeting Summary', defaultFormat: 'pdf', allowedFormats: ['pdf'] },
  { key: 'attendance', label: 'Attendance', defaultFormat: 'pdf', allowedFormats: ['pdf', 'xlsx'] },
  { key: 'kpi', label: 'KPI Snapshot', defaultFormat: 'xlsx', allowedFormats: ['pdf', 'xlsx'] },
  { key: 'notes', label: 'Notes & Discussion', defaultFormat: 'pdf', allowedFormats: ['pdf'] },
  { key: 'decisions', label: 'Decisions', defaultFormat: 'pdf', allowedFormats: ['pdf', 'xlsx'] },
  { key: 'tasks', label: 'Tasks Created', defaultFormat: 'xlsx', allowedFormats: ['pdf', 'xlsx'] },
];

export interface SectionSelection {
  key: SectionKey;
  selected: boolean;
  format: SectionFormat;
}

export function defaultSectionSelections(): SectionSelection[] {
  return MEETING_EXPORT_SECTIONS.map((s) => ({
    key: s.key,
    selected: true,
    format: s.defaultFormat,
  }));
}

export function chosenFormats(selections: SectionSelection[]): {
  pdf: SectionKey[];
  xlsx: SectionKey[];
} {
  const pdf: SectionKey[] = [];
  const xlsx: SectionKey[] = [];
  for (const s of selections) {
    if (!s.selected) continue;
    if (s.format === 'pdf') pdf.push(s.key);
    else xlsx.push(s.key);
  }
  return { pdf, xlsx };
}
