import { describe, it, expect } from 'vitest';
import { formatIndianNumber, formatIndianNumberString } from '@/lib/formatNumber';

describe('formatIndianNumber', () => {
  it('returns "999" for 999 (no commas under 1000)', () => {
    expect(formatIndianNumber(999)).toBe('999');
  });

  it('returns "1,000" for 1000', () => {
    expect(formatIndianNumber(1000)).toBe('1,000');
  });

  it('returns "10,000" for 10000', () => {
    expect(formatIndianNumber(10000)).toBe('10,000');
  });

  it('returns "1,00,000" for 100000 (lakh grouping)', () => {
    expect(formatIndianNumber(100000)).toBe('1,00,000');
  });

  it('returns "15,00,000" for 1500000', () => {
    expect(formatIndianNumber(1500000)).toBe('15,00,000');
  });

  it('returns "1.5" for 1.5 (auto decimals)', () => {
    expect(formatIndianNumber(1.5)).toBe('1.5');
  });

  it('rounds 1.505 to "1.51" (max 2 decimals)', () => {
    expect(formatIndianNumber(1.505)).toBe('1.51');
  });

  it('returns "—" for null', () => {
    expect(formatIndianNumber(null)).toBe('—');
  });

  it('returns "—" for undefined', () => {
    expect(formatIndianNumber(undefined)).toBe('—');
  });

  it('returns "0" for 0', () => {
    expect(formatIndianNumber(0)).toBe('0');
  });

  it('handles negatives with grouping', () => {
    expect(formatIndianNumber(-100000)).toBe('-1,00,000');
  });

  it('uses fixed decimals when provided', () => {
    expect(formatIndianNumber(1000, 2)).toBe('1,000.00');
    expect(formatIndianNumber(0.1, 1)).toBe('0.1');
  });

  it('returns "—" for NaN', () => {
    expect(formatIndianNumber(NaN)).toBe('—');
  });
});

describe('formatIndianNumberString', () => {
  it('handles numeric strings', () => {
    expect(formatIndianNumberString('100000')).toBe('1,00,000');
  });
  it('returns "—" for empty/null/undefined', () => {
    expect(formatIndianNumberString('')).toBe('—');
    expect(formatIndianNumberString(null)).toBe('—');
    expect(formatIndianNumberString(undefined)).toBe('—');
  });
  it('passes through non-numeric strings', () => {
    expect(formatIndianNumberString('abc')).toBe('abc');
  });
});
