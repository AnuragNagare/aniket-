import { describe, expect, it } from 'vitest';
import { parseRange, presetRange, rangeQuery } from '../src/period.js';

describe('date ranges', () => {
  // 2026-10-07 is a Wednesday.
  it.each([
    ['today', '2026-10-07', '2026-10-07'],
    ['yesterday', '2026-10-06', '2026-10-06'],
    ['this-week', '2026-10-05', '2026-10-07'],
    ['last-week', '2026-09-28', '2026-10-04'],
    ['this-month', '2026-10-01', '2026-10-07'],
  ] as const)('%s', (preset, from, to) => {
    expect(presetRange(preset, '2026-10-07')).toEqual({ from, to });
  });

  it('this week on a Monday is just that Monday', () => {
    expect(presetRange('this-week', '2026-10-05')).toEqual({ from: '2026-10-05', to: '2026-10-05' });
  });

  it('this week on a Sunday goes back to Monday', () => {
    expect(presetRange('this-week', '2026-10-11')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
  });

  it('parses a custom range and builds its query', () => {
    const r = parseRange({ range: 'custom', from: '2026-09-20', to: '2026-10-01' }, '2026-10-07');
    expect(r).toMatchObject({ preset: 'custom', from: '2026-09-20', to: '2026-10-01', error: null });
    expect(rangeQuery(r)).toBe('?range=custom&from=2026-09-20&to=2026-10-01');
    expect(r.label).toBe('20 Sep – 1 Oct 2026');
  });

  it('falls back to today with a message for a range over 31 days', () => {
    const r = parseRange({ range: 'custom', from: '2026-08-01', to: '2026-10-07' }, '2026-10-07');
    expect(r).toMatchObject({ preset: 'today', from: '2026-10-07', error: 'Choose at most 31 days.' });
  });

  it('defaults to today', () => {
    expect(parseRange({}, '2026-10-07')).toMatchObject({ preset: 'today', label: 'Today' });
  });
});
