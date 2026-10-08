import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeletionRequestDto } from '@worktrail/types';
import { api } from '../api';

export function useRequestDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reason?: string): Promise<DeletionRequestDto> => {
      const res = await api.request<DeletionRequestDto>('POST', '/me/deletion-request', { reason });
      return res;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
