import { z } from 'zod';

/** Accepts common ways people type Indian mobiles; returns E.164 (+91XXXXXXXXXX) or null. */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

export const IndianMobileSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeIndianMobile(value);
  if (!normalized) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.',
    });
    return z.NEVER;
  }
  return normalized;
});
