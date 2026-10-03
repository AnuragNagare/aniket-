import { describe, expect, it } from 'vitest';
import { normalizeIndianMobile, IndianMobileSchema } from '../src/phone.js';

describe('normalizeIndianMobile', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+919876543210', '+919876543210'],
  ])('normalises %s', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it.each(['12345', '5876543210', '98765432101', '', 'abcdefghij'])('rejects %s', (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });

  it('schema reports a readable message', () => {
    const r = IndianMobileSchema.safeParse('12345');
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(
      'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.',
    );
  });
});
