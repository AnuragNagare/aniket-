import 'server-only';
import { cache } from 'react';
import type { AuthUser } from '@worktrail/types';
import { serverApi } from './server-api';

/** The signed-in admin, fetched once per request even if the layout and page both ask. */
export const getCurrentUser = cache(() => serverApi<AuthUser>('/auth/me'));
