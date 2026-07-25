import { describe, it, expect } from 'vitest';
import {
  isSignOutAlwaysRendered,
  getUserDisplayName,
  getUserInitials,
} from '@/lib/userDisplay';

describe('userDisplay', () => {
  describe('isSignOutAlwaysRendered', () => {
    it.each([
      'super_admin',
      'factory_manager',
      'department_head',
      'team_member',
      'shop_floor',
      '',
      undefined,
      null as unknown as string,
    ])('returns true for role=%s', (role) => {
      expect(isSignOutAlwaysRendered(role as string)).toBe(true);
    });
  });

  describe('getUserDisplayName', () => {
    it('returns full_name when present', () => {
      expect(getUserDisplayName({ full_name: 'Marut Shukla' })).toBe('Marut Shukla');
    });
    it('returns empty string when null', () => {
      expect(getUserDisplayName(null)).toBe('');
    });
    it('returns empty string when full_name missing', () => {
      expect(getUserDisplayName({})).toBe('');
    });
  });

  describe('getUserInitials', () => {
    it('returns first+last initials for two-part name', () => {
      expect(getUserInitials('Marut Shukla')).toBe('MS');
    });
    it('returns single initial for single name', () => {
      expect(getUserInitials('Nethaji')).toBe('N');
    });
    it('returns ? for null', () => {
      expect(getUserInitials(null)).toBe('?');
    });
    it('returns ? for undefined', () => {
      expect(getUserInitials(undefined)).toBe('?');
    });
    it('returns ? for empty/whitespace', () => {
      expect(getUserInitials('   ')).toBe('?');
    });
    it('uses first and last for 3+ word names', () => {
      expect(getUserInitials('John Adam Doe')).toBe('JD');
    });
  });
});
