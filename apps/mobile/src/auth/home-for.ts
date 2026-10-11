import type { Role } from '@worktrail/types';

/** Which half of the app a signed-in person belongs to. The role comes from the server's token response. */
export const homeFor = (role: Role | null | undefined): 'employee' | 'admin' | null =>
  !role ? null : role === 'EMPLOYEE' ? 'employee' : 'admin';
