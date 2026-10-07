import { extractInviteToken } from '../src/auth/invite-token';

const T = 'KPCJwGEbnzgh2-WdirU_MssvgWChJLBPYVqFlKTWAOM';

describe('extractInviteToken', () => {
  it.each([
    [`http://localhost:3000/invite/${T}`],
    [`https://app.worktrail.in/invite/${T}?utm=wa`],
    [
      `Join our team on Work Trail. Set your password here: https://app.worktrail.in/invite/${T}`,
    ],
    [`worktrail://invite/${T}`],
    [`  ${T}  `],
  ])('finds the token in %s', (text) => {
    expect(extractInviteToken(text)).toBe(T);
  });

  it.each(['', 'hello', 'https://app.worktrail.in/login'])('returns null for %s', (text) => {
    expect(extractInviteToken(text)).toBeNull();
  });
});
