import { dateTimeIn, formatMinutes, initials, timeIn } from '../../src/admin/format';

describe('admin format helpers', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(0)).toBe('0m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(384)).toBe('6h 24m');
    expect(formatMinutes(120)).toBe('2h 0m');
  });

  it('shows times in the company timezone, not the phone timezone', () => {
    expect(timeIn('2026-10-05T03:32:00.000Z', 'Asia/Kolkata')).toBe('9:02 AM');
    expect(dateTimeIn('2026-10-05T03:32:00.000Z', 'Asia/Kolkata')).toBe('Mon 5 Oct, 9:02 AM');
  });

  it('makes initials from one or two words', () => {
    expect(initials('Amit Kumar')).toBe('AK');
    expect(initials('neha')).toBe('NE');
    expect(initials('  Rohit   Singh  ')).toBe('RS');
  });
});
