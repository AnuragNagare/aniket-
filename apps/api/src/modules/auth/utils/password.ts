import argon2 from 'argon2';

export const hashPassword = (plain: string) => argon2.hash(plain, { type: argon2.argon2id });

export const verifyPassword = (hash: string, plain: string) =>
  argon2.verify(hash, plain).catch(() => false);

let dummyHash: Promise<string> | undefined;

/** Spends the same time as a real check when the email is unknown, so timing can't reveal accounts. */
export async function verifyAgainstDummy(plain: string): Promise<false> {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  await verifyPassword(await dummyHash, plain);
  return false;
}
