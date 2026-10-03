import type { Role } from '@worktrail/types';

/** Who is calling, taken from a verified access token. Set on `req.auth` by JwtAuthGuard. */
export type AuthContext = { userId: string; companyId: string; role: Role };

/** Claims carried inside the access token. */
export type AccessTokenClaims = { sub: string; cid: string; role: Role };
