import { useQuery } from '@tanstack/react-query';
import type { PrivacyNotice } from '@worktrail/types';
import { api } from '../api';

export const PRIVACY_NOTICE_KEY = ['privacy', 'notice'] as const;

export function usePrivacyNotice() {
  return useQuery({
    queryKey: PRIVACY_NOTICE_KEY,
    queryFn: () => api.request<PrivacyNotice>('GET', '/privacy/notice'),
    staleTime: 5 * 60_000,
  });
}
