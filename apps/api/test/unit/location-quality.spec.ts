import { describe, expect, it } from 'vitest';
import { qualityFor } from '../../src/common/utils/location-quality.js';

const now = new Date('2026-10-05T04:00:00Z');

describe('qualityFor', () => {
  it('is GOOD for an accurate, current fix', () => {
    expect(qualityFor(18, new Date('2026-10-05T03:59:00Z'), now)).toBe('GOOD');
  });
  it('is LOW_ACCURACY when accuracy is worse than 100 m or unknown', () => {
    expect(qualityFor(250, now, now)).toBe('LOW_ACCURACY');
    expect(qualityFor(null, now, now)).toBe('LOW_ACCURACY');
  });
  it('is SUSPICIOUS when the phone says the fix is from the future', () => {
    expect(qualityFor(10, new Date('2026-10-05T04:06:00Z'), now)).toBe('SUSPICIOUS');
  });
});
