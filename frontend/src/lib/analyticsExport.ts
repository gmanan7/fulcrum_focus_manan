/**
 * Pure utilities for the Admin Analytics PDF export.
 * Kept dependency-free so they can be unit tested.
 */

export function generateAnalyticsFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `Analytics_Report_${y}-${m}-${d}_ITC_PPB_NPF.pdf`;
}

export interface ExecutiveSummaryInput {
  inactiveUsers?: { id: string; name: string }[];
  lowComplianceDepts?: { id: string; name: string; compliance: number }[];
  pushbackTasks?: { id: string; title: string; pushbacks: number }[];
  zeroTaskMeetingsThisWeek?: number;
}

export interface ExecutiveSummary {
  inactiveUsers: { id: string; name: string }[];
  lowComplianceDepts: { id: string; name: string; compliance: number }[];
  pushbackTasks: { id: string; title: string; pushbacks: number }[];
  zeroTaskMeetingsThisWeek: number;
}

/**
 * Build the executive summary signal block.
 * Always returns all four categories so the PDF builder can render
 * predictable shape, even when categories are empty.
 */
export function buildExecutiveSummary(input: ExecutiveSummaryInput): ExecutiveSummary {
  return {
    inactiveUsers: input.inactiveUsers ?? [],
    lowComplianceDepts: input.lowComplianceDepts ?? [],
    pushbackTasks: input.pushbackTasks ?? [],
    zeroTaskMeetingsThisWeek: input.zeroTaskMeetingsThisWeek ?? 0,
  };
}
