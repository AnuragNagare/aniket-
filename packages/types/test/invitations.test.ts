import { describe, expect, it } from 'vitest';
import {
  AcceptInvitationSchema,
  ForgotPasswordSchema,
  InviteEmployeeSchema,
  ResetPasswordSchema,
} from '../src/index.js';

describe('InviteEmployeeSchema', () => {
  it('normalises email and phone, drops blank optional fields', () => {
    const out = InviteEmployeeSchema.parse({
      name: ' Ravi Kumar ',
      email: ' Ravi@Example.com ',
      phone: '98765 43210',
      designation: '  ',
      employeeCode: '',
    });
    expect(out).toEqual({ name: 'Ravi Kumar', email: 'ravi@example.com', phone: '+919876543210' });
  });

  it('accepts a missing or empty phone', () => {
    expect(InviteEmployeeSchema.parse({ name: 'Ravi', email: 'r@x.in', phone: '' }).phone).toBeUndefined();
    expect(InviteEmployeeSchema.parse({ name: 'Ravi', email: 'r@x.in' }).phone).toBeUndefined();
  });

  it('requires an email because employees sign in with it', () => {
    const r = InviteEmployeeSchema.safeParse({ name: 'Ravi', email: '' });
    expect(r.error?.issues[0]?.message).toBe('Enter a valid email address.');
  });

  it('rejects a bad phone with the usual message', () => {
    const r = InviteEmployeeSchema.safeParse({ name: 'Ravi', email: 'r@x.in', phone: '12345' });
    expect(r.error?.issues[0]?.message).toBe(
      'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.',
    );
  });
});

describe('accept and reset', () => {
  it('AcceptInvitationSchema applies the password rule', () => {
    const r = AcceptInvitationSchema.safeParse({ name: 'Ravi Kumar', password: 'short' });
    expect(r.error?.issues[0]?.message).toBe('Use at least 8 characters.');
  });

  it('ForgotPasswordSchema normalises the email', () => {
    expect(ForgotPasswordSchema.parse({ email: ' A@B.IN ' }).email).toBe('a@b.in');
  });

  it('ResetPasswordSchema needs a token and a valid password', () => {
    expect(ResetPasswordSchema.safeParse({ token: 'x', password: 'StrongPass1' }).success).toBe(false);
    expect(
      ResetPasswordSchema.safeParse({ token: 'a'.repeat(43), password: 'StrongPass1' }).success,
    ).toBe(true);
  });
});
