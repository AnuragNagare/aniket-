import { describe, expect, it } from 'vitest';
import { AdminSignupSchema, LoginSchema } from '../src/auth.js';

const valid = {
  companyName: 'Acme Services',
  name: 'Rahul Sharma',
  email: '  Rahul@Acme.IN ',
  phone: '98765 43210',
  password: 'StrongPass1',
};

describe('AdminSignupSchema', () => {
  it('trims, lowercases email and normalises phone', () => {
    const out = AdminSignupSchema.parse(valid);
    expect(out.email).toBe('rahul@acme.in');
    expect(out.phone).toBe('+919876543210');
  });

  it('rejects short passwords with a plain message', () => {
    const r = AdminSignupSchema.safeParse({ ...valid, password: 'short' });
    expect(r.error?.issues[0]?.message).toBe('Use at least 8 characters.');
  });
});

describe('LoginSchema', () => {
  it('normalises email', () => {
    expect(LoginSchema.parse({ email: ' A@B.IN', password: 'x' }).email).toBe('a@b.in');
  });
});
