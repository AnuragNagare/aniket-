import { dayBounds, isIsoDate, minutesWithin, previousDay, todayIn } from '../../src/common/utils/time.js';

const TZ = 'Asia/Kolkata';

describe('time helpers', () => {
  it('todayIn uses the company timezone, not UTC', () => {
    // 2026-10-04 00:15 IST == 2026-10-03 18:45 UTC
    expect(todayIn(TZ, new Date('2026-10-03T18:45:00Z'))).toBe('2026-10-04');
  });

  it('dayBounds spans IST midnight to midnight', () => {
    const { start, end } = dayBounds('2026-10-04', TZ);
    expect(start.toISOString()).toBe('2026-10-03T18:30:00.000Z');
    expect(end.toISOString()).toBe('2026-10-04T18:30:00.000Z');
  });

  it('previousDay crosses month boundaries', () => {
    expect(previousDay('2026-10-01')).toBe('2026-09-30');
  });

  it('splits a session across midnight', () => {
    // 23:30–00:30 IST
    const s = [{ start: new Date('2026-10-03T18:00:00Z'), end: new Date('2026-10-03T19:00:00Z') }];
    const d3 = dayBounds('2026-10-03', TZ);
    const d4 = dayBounds('2026-10-04', TZ);
    const now = new Date('2026-10-05T00:00:00Z');
    expect(minutesWithin(s, d3.start, d3.end, now)).toBe(30);
    expect(minutesWithin(s, d4.start, d4.end, now)).toBe(30);
  });

  it('counts an open session up to now', () => {
    const d = dayBounds('2026-10-04', TZ);
    const now = new Date('2026-10-04T05:30:00Z'); // 11:00 IST
    const s = [{ start: new Date('2026-10-04T03:30:00Z'), end: null }]; // 09:00 IST
    expect(minutesWithin(s, d.start, d.end, now)).toBe(120);
  });

  it.each(['2026-13-45', '2026-02-30', '04-10-2026', '', 'today'])('rejects date %s', (s) => {
    expect(isIsoDate(s)).toBe(false);
  });

  it('accepts a real calendar date', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
  });
});
