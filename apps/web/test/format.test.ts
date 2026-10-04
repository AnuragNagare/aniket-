import { describe, expect, it } from 'vitest';
import {
  firstName,
  formatHours,
  formatMinutes,
  greeting,
  initials,
  percentChange,
  timeIn,
} from '@/lib/format';

describe('format', () => {
  it('formatMinutes', () => {
    expect(formatMinutes(384)).toBe('6h 24m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(0)).toBe('0m');
  });

  it('formatHours rounds down to whole hours', () => {
    expect(formatHours(5190)).toBe('86h');
    expect(formatHours(59)).toBe('0h');
  });

  it('percentChange is null when there is no baseline', () => {
    expect(percentChange(12, 0)).toBeNull();
    expect(percentChange(24, 20)).toBe(20);
    expect(percentChange(15, 20)).toBe(-25);
  });

  it('greeting follows the company timezone', () => {
    expect(greeting(new Date('2026-10-04T02:00:00Z'), 'Asia/Kolkata')).toBe('Good morning'); // 07:30 IST
    expect(greeting(new Date('2026-10-04T08:00:00Z'), 'Asia/Kolkata')).toBe('Good afternoon'); // 13:30 IST
    expect(greeting(new Date('2026-10-04T13:00:00Z'), 'Asia/Kolkata')).toBe('Good evening'); // 18:30 IST
  });

  it('timeIn renders the company-local clock time', () => {
    expect(timeIn('2026-10-04T04:48:00Z', 'Asia/Kolkata')).toBe('10:18 AM');
  });

  it('initials and firstName', () => {
    expect(initials('Rahul Sharma')).toBe('RS');
    expect(initials('neha')).toBe('NE');
    expect(firstName('  Rahul   Sharma ')).toBe('Rahul');
  });
});
