/**
 * PD Cycle pure logic helpers — no React, no Supabase.
 * Imported by UI and by tests.
 */
export const PIP_DEPARTMENT_ID = '5011afbf-efed-4494-85ca-5aa455453441';

export type PDStage =
  | 'upcoming'
  | 'in_process'
  | 'processing_finished'
  | 'feedback_approved'
  | 'feedback_rejected'
  | 'abandoned';

export type AppRoleLike = string;

export const PD_STAGE_LABEL: Record<PDStage, string> = {
  upcoming: 'Upcoming',
  in_process: 'In Process',
  processing_finished: 'Processing Finished',
  feedback_approved: 'Approved',
  feedback_rejected: 'Rejected',
  abandoned: 'Abandoned',
};

// Tailwind classes for stage pills. Uses semantic tokens where they exist
// so colours stay consistent across the three project themes.
export const PD_STAGE_PILL: Record<PDStage, string> = {
  upcoming: 'bg-primary/15 text-primary',
  in_process: 'bg-rag-amber/20 text-warning',
  processing_finished: 'bg-purple-500/15 text-purple-600 dark:text-purple-300',
  feedback_approved: 'bg-rag-green/20 text-success',
  feedback_rejected: 'bg-destructive/15 text-destructive',
  abandoned: 'bg-muted text-muted-foreground',
};

export type KanbanColumnKey = 'upcoming' | 'in_process' | 'processing_finished' | 'closed';

export const KANBAN_COLUMNS: { key: KanbanColumnKey; label: string; stages: PDStage[] }[] = [
  { key: 'upcoming', label: 'Upcoming', stages: ['upcoming'] },
  { key: 'in_process', label: 'In Process', stages: ['in_process'] },
  { key: 'processing_finished', label: 'Processing Finished', stages: ['processing_finished'] },
  {
    key: 'closed',
    label: 'Customer Feedback & Closed',
    stages: ['feedback_approved', 'feedback_rejected', 'abandoned'],
  },
];

const TERMINAL: PDStage[] = ['feedback_approved', 'feedback_rejected', 'abandoned'];
export function isTerminalStage(s: PDStage): boolean {
  return TERMINAL.includes(s);
}

/** Stages a PD-team user is allowed to move TO from `current` (forward only). */
export function nextStageOptions(current: PDStage): PDStage[] {
  switch (current) {
    case 'upcoming':
      return ['in_process', 'abandoned'];
    case 'in_process':
      return ['processing_finished', 'abandoned'];
    case 'processing_finished':
      return ['feedback_approved', 'feedback_rejected', 'abandoned'];
    default:
      return [];
  }
}

/** PD team = super_admin OR factory_manager OR member of PIP department. */
export function isPDTeam(
  roles: AppRoleLike[] | null | undefined,
  departmentIds: string[] | null | undefined
): boolean {
  const r = roles ?? [];
  if (r.includes('super_admin') || r.includes('factory_manager')) return true;
  return (departmentIds ?? []).includes(PIP_DEPARTMENT_ID);
}

/** Whole-day diff (now - from) in days, never negative. */
export function ageInDays(fromIso: string | null | undefined, now: Date = new Date()): number {
  if (!fromIso) return 0;
  const t = new Date(fromIso).getTime();
  if (isNaN(t)) return 0;
  const diff = Math.floor((now.getTime() - t) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/** Filter jobs by case-insensitive query against title/customer/product/PD#. */
export function pdJobMatchesQuery(
  job: { title?: string | null; customer?: string | null; product?: string | null; job_number?: number | null },
  query: string
): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();
  const numMatch = q.match(/^(?:pd[-#\s]*)?#?(\d+)$/);
  if (numMatch) {
    if (job.job_number === parseInt(numMatch[1], 10)) return true;
  }
  return [job.title, job.customer, job.product].some(
    (f) => typeof f === 'string' && f.toLowerCase().includes(q)
  );
}

/**
 * Validate the client-side stage change form. Mirrors RPC checks so we can
 * show errors before round-tripping.
 */
export interface StageChangeInput {
  current: PDStage;
  next: PDStage;
  note?: string | null;
  feedbackNote?: string | null;
}

export function validateStageChange(input: StageChangeInput): { ok: true } | { ok: false; error: string } {
  const allowed = nextStageOptions(input.current);
  if (!allowed.includes(input.next)) {
    return { ok: false, error: `Cannot move from ${PD_STAGE_LABEL[input.current]} to ${PD_STAGE_LABEL[input.next]}` };
  }
  if (
    (input.next === 'feedback_rejected' || input.next === 'abandoned') &&
    !(input.feedbackNote && input.feedbackNote.trim().length > 0)
  ) {
    return { ok: false, error: 'A feedback note is required when marking a job rejected or abandoned.' };
  }
  return { ok: true };
}

/** Bucket a job into one of the four kanban columns. */
export function columnForStage(stage: PDStage): KanbanColumnKey {
  return (KANBAN_COLUMNS.find((c) => c.stages.includes(stage))?.key) ?? 'upcoming';
}
