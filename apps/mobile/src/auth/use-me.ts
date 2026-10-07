import { useQuery } from '@tanstack/react-query';
import type { MeResponse } from '@worktrail/types';
import { api } from '../api';

export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () => api.request<MeResponse>('GET', '/me'),
    staleTime: 5 * 60_000,
  });
