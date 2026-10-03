import { SetMetadata } from '@nestjs/common';
import type { Role } from '@worktrail/types';

export const ROLES = 'roles';

/** Restricts a controller or route to the given roles (checked by RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
