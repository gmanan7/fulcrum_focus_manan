/**
 * Pure client-side task search. Used by Task Board across Kanban,
 * List, and Calendar views. Runs after chip filters.
 */
export function searchMatches(task: any, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  // Task number: "#12" or "12"
  const numMatch = q.match(/^#?(\d+)$/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (task?.task_number === num) return true;
  }

  const fields: Array<string | null | undefined> = [
    task?.title,
    task?.description,
    task?.owner?.full_name,
    task?.dept?.name,
    task?.resolution_note,
    task?.group?.name,
  ];

  return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(q));
}

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Split text into segments for highlight rendering. Each segment marks
 * whether it matches the (case-insensitive) query. Empty / blank query
 * returns a single non-matching segment.
 */
export function highlightSegments(
  text: string | null | undefined,
  query: string
): Array<{ text: string; match: boolean }> {
  if (!text) return [{ text: '', match: false }];
  if (!query || !query.trim()) return [{ text, match: false }];
  const q = query.trim();
  const re = new RegExp(`(${escapeRegExp(q)})`, 'ig');
  const parts = text.split(re);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ text: p, match: p.toLowerCase() === q.toLowerCase() }));
}
