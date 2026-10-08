import { describe, expect, it } from 'vitest';
import {
  ConsentSchema,
  DeletionRequestSchema,
  PRIVACY_NOTICE_VERSION,
} from '../src/index.js';

describe('Privacy types & schemas', () => {
  it('defines PRIVACY_NOTICE_VERSION', () => {
    expect(PRIVACY_NOTICE_VERSION).toBe('2026-10-v1');
  });

  it('validates ConsentSchema with valid and invalid payloads', () => {
    const valid = {
      version: '2026-10-v1',
      appVersion: '1.0.0',
      deviceModel: 'Samsung Galaxy A15',
    };
    expect(ConsentSchema.parse(valid)).toEqual(valid);

    // Minimal valid
    expect(ConsentSchema.parse({ version: '2026-10-v1' })).toEqual({
      version: '2026-10-v1',
    });

    // Invalid: missing version
    expect(ConsentSchema.safeParse({}).success).toBe(false);
    // Invalid: version too long
    expect(ConsentSchema.safeParse({ version: 'v'.repeat(33) }).success).toBe(false);
  });

  it('validates DeletionRequestSchema', () => {
    expect(DeletionRequestSchema.parse({ reason: 'Left company' })).toEqual({
      reason: 'Left company',
    });
    expect(DeletionRequestSchema.parse({})).toEqual({});
    expect(DeletionRequestSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
  });
});
