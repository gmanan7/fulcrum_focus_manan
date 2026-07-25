import { describe, it, expect } from 'vitest';
import {
  isPDTeam,
  nextStageOptions,
  isTerminalStage,
  pdJobMatchesQuery,
  validateStageChange,
  columnForStage,
  ageInDays,
  PIP_DEPARTMENT_ID,
} from '@/lib/pdCycle';

describe('isPDTeam', () => {
  it('true for super_admin', () => {
    expect(isPDTeam(['super_admin'], [])).toBe(true);
  });
  it('true for factory_manager', () => {
    expect(isPDTeam(['factory_manager'], [])).toBe(true);
  });
  it('true for PIP department member', () => {
    expect(isPDTeam(['team_member'], [PIP_DEPARTMENT_ID])).toBe(true);
  });
  it('false for unrelated user', () => {
    expect(isPDTeam(['team_member'], ['other-dept-id'])).toBe(false);
    expect(isPDTeam(null, null)).toBe(false);
  });
});

describe('nextStageOptions', () => {
  it('upcoming -> in_process | abandoned', () => {
    expect(nextStageOptions('upcoming')).toEqual(['in_process', 'abandoned']);
  });
  it('in_process -> processing_finished | abandoned', () => {
    expect(nextStageOptions('in_process')).toEqual(['processing_finished', 'abandoned']);
  });
  it('processing_finished -> 3 terminal options', () => {
    expect(nextStageOptions('processing_finished')).toEqual([
      'feedback_approved',
      'feedback_rejected',
      'abandoned',
    ]);
  });
  it('terminal stages have no forward moves', () => {
    expect(nextStageOptions('feedback_approved')).toEqual([]);
    expect(nextStageOptions('feedback_rejected')).toEqual([]);
    expect(nextStageOptions('abandoned')).toEqual([]);
  });
});

describe('isTerminalStage', () => {
  it('classifies terminal vs active', () => {
    expect(isTerminalStage('feedback_approved')).toBe(true);
    expect(isTerminalStage('feedback_rejected')).toBe(true);
    expect(isTerminalStage('abandoned')).toBe(true);
    expect(isTerminalStage('upcoming')).toBe(false);
    expect(isTerminalStage('in_process')).toBe(false);
    expect(isTerminalStage('processing_finished')).toBe(false);
  });
});

describe('columnForStage', () => {
  it('all 3 terminal stages map to the closed column', () => {
    expect(columnForStage('feedback_approved')).toBe('closed');
    expect(columnForStage('feedback_rejected')).toBe('closed');
    expect(columnForStage('abandoned')).toBe('closed');
  });
  it('active stages map 1-1', () => {
    expect(columnForStage('upcoming')).toBe('upcoming');
    expect(columnForStage('in_process')).toBe('in_process');
    expect(columnForStage('processing_finished')).toBe('processing_finished');
  });
});

describe('pdJobMatchesQuery', () => {
  const job = { title: 'Sleeve label trial', customer: 'ITC Foods', product: 'Aashirvaad', job_number: 7 };
  it('blank query matches', () => {
    expect(pdJobMatchesQuery(job, '')).toBe(true);
  });
  it('title substring case-insensitive', () => {
    expect(pdJobMatchesQuery(job, 'SLEEVE')).toBe(true);
  });
  it('customer match', () => {
    expect(pdJobMatchesQuery(job, 'itc')).toBe(true);
  });
  it('product match', () => {
    expect(pdJobMatchesQuery(job, 'aashir')).toBe(true);
  });
  it('PD# match with and without prefix', () => {
    expect(pdJobMatchesQuery(job, '7')).toBe(true);
    expect(pdJobMatchesQuery(job, '#7')).toBe(true);
    expect(pdJobMatchesQuery(job, 'PD7')).toBe(true);
    expect(pdJobMatchesQuery(job, 'PD#7')).toBe(true);
    expect(pdJobMatchesQuery(job, '8')).toBe(false);
  });
  it('no match returns false', () => {
    expect(pdJobMatchesQuery(job, 'zzz')).toBe(false);
  });
});

describe('validateStageChange', () => {
  it('rejects invalid transition', () => {
    expect(validateStageChange({ current: 'upcoming', next: 'feedback_approved' }).ok).toBe(false);
  });
  it('rejects missing feedback_note when going to rejected', () => {
    const r = validateStageChange({ current: 'processing_finished', next: 'feedback_rejected' });
    expect(r.ok).toBe(false);
  });
  it('rejects missing feedback_note when going to abandoned', () => {
    const r = validateStageChange({ current: 'in_process', next: 'abandoned' });
    expect(r.ok).toBe(false);
  });
  it('accepts approved without feedback_note', () => {
    expect(validateStageChange({ current: 'processing_finished', next: 'feedback_approved' }).ok).toBe(true);
  });
  it('accepts rejected with feedback_note', () => {
    expect(
      validateStageChange({ current: 'processing_finished', next: 'feedback_rejected', feedbackNote: 'colour off' }).ok
    ).toBe(true);
  });
});

describe('ageInDays', () => {
  it('returns whole-day diff', () => {
    const now = new Date('2026-06-12T12:00:00Z');
    expect(ageInDays('2026-06-10T12:00:00Z', now)).toBe(2);
  });
  it('clamps negatives and handles missing input', () => {
    expect(ageInDays(null)).toBe(0);
    expect(ageInDays('not-a-date')).toBe(0);
  });
});
