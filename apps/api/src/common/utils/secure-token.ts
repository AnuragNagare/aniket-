import { createHash, randomBytes } from 'node:crypto';

/** 256 bits of randomness, URL-safe. Used for invite and password-reset links. */
export const newToken = () => randomBytes(32).toString('base64url');

/** Tokens are stored only as this hash, so a database leak can't be replayed as links. */
export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
