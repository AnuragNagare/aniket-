import { describe, expect, it } from 'vitest';
import { CreateUpdateSchema, HistoryQuerySchema, UPDATE_CATEGORY_LABELS } from '../src/index.js';

const base = {
  clientUpdateId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
  sessionId: '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f',
  text: 'Visited client site, completed installation.',
  inputMethod: 'VOICE',
  submittedAt: '2026-10-06T06:00:00.000Z',
};

describe('CreateUpdateSchema', () => {
  it('trims the text and accepts an optional category', () => {
    const out = CreateUpdateSchema.parse({ ...base, text: '  Done at site.  ', category: 'SITE_VISIT' });
    expect(out.text).toBe('Done at site.');
    expect(out.category).toBe('SITE_VISIT');
  });

  it.each([
    ['abcd', 'Write at least 5 characters.'],
    ['        ', 'Write at least 5 characters.'],
    ['x'.repeat(2001), 'Keep it under 2,000 characters.'],
  ])('rejects %#', (text, message) => {
    expect(CreateUpdateSchema.safeParse({ ...base, text }).error?.issues[0]?.message).toBe(message);
  });

  it('accepts exactly 2,000 characters', () => {
    expect(CreateUpdateSchema.safeParse({ ...base, text: 'x'.repeat(2000) }).success).toBe(true);
  });

  it('rejects an unknown category', () => {
    expect(CreateUpdateSchema.safeParse({ ...base, category: 'PARTY' }).success).toBe(false);
  });

  it('has a readable label for every category', () => {
    expect(UPDATE_CATEGORY_LABELS.SERVICE_REPAIR).toBe('Service or repair');
  });
});

describe('HistoryQuerySchema', () => {
  it('accepts up to 31 days and rejects reversed or longer ranges', () => {
    expect(HistoryQuerySchema.safeParse({ from: '2026-09-06', to: '2026-10-06' }).success).toBe(true);
    expect(HistoryQuerySchema.safeParse({ from: '2026-10-06', to: '2026-10-01' }).error?.issues[0]?.message).toBe('The end date must be on or after the start date.');
    expect(HistoryQuerySchema.safeParse({ from: '2026-08-01', to: '2026-10-06' }).error?.issues[0]?.message).toBe('Choose at most 31 days.');
  });
});
