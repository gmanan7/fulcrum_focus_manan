/**
 * Format numbers using the Indian numbering system (lakh/crore grouping).
 * 1000 -> "1,000"
 * 100000 -> "1,00,000"
 * 1500000 -> "15,00,000"
 *
 * - When `decimals` is provided, uses fixed decimal places.
 * - Otherwise, shows up to 2 decimals and trims trailing zeros.
 * - null/undefined -> "—"
 */
export function formatIndianNumber(
  value: number | null | undefined,
  decimals?: number,
): string {
  if (value === null || value === undefined) return '—';
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';

  if (decimals !== undefined) {
    return value.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  return value.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  });
}

/**
 * Format a numeric string (e.g., from a DB column or input) using Indian grouping.
 * Returns the original string if it is not a valid number.
 */
export function formatIndianNumberString(
  value: string | number | null | undefined,
  decimals?: number,
): string {
  if (value === null || value === undefined || value === '') return '—';
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return formatIndianNumber(num, decimals);
}
