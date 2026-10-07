import {
  dayTimeLabel,
  elapsedMs,
  formatElapsed,
  isStale,
  timeLabel,
} from '../src/sessions/session-logic';

const TZ = 'Asia/Kolkata';

describe('session logic', () => {
  it('formats elapsed time as h:mm:ss', () => {
    expect(formatElapsed(0)).toBe('0:00:00');
    expect(formatElapsed(3_909_000)).toBe('1:05:09');
    expect(formatElapsed(-5_000)).toBe('0:00:00');
  });

  it('uses server time, so a wrong phone clock does not change the timer', () => {
    const startedAt = '2026-10-05T03:30:00.000Z';
    const realNow = Date.parse('2026-10-05T04:30:00.000Z');
    const phoneNow = realNow - 3 * 3600_000; // phone is 3 h slow
    const offsetMs = realNow - phoneNow; // measured from serverTime
    expect(elapsedMs(startedAt, offsetMs, phoneNow)).toBe(3600_000);
  });

  it('shows clock times in the company timezone', () => {
    expect(timeLabel('2026-10-05T03:32:00.000Z', TZ)).toBe('9:02 AM');
    expect(dayTimeLabel('2026-10-04T03:32:00.000Z', TZ)).toBe('Sun 4 Oct at 9:02 AM');
  });

  it('treats a session from an earlier day, or older than 14 hours, as left running', () => {
    expect(isStale('2026-10-04T03:30:00.000Z', new Date('2026-10-05T03:00:00Z'), TZ)).toBe(true);
    expect(isStale('2026-10-05T03:30:00.000Z', new Date('2026-10-05T12:00:00Z'), TZ)).toBe(false);
    expect(isStale('2026-10-05T00:30:00.000Z', new Date('2026-10-05T15:00:00Z'), TZ)).toBe(true);
  });
});
