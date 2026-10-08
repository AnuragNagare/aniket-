import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import type { ConsentDto } from '@worktrail/types';
import { api } from '../api';

export function useRecordConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (version: string): Promise<ConsentDto> => {
      const res = await api.request<ConsentDto>('POST', '/me/consent', {
        version,
        appVersion: Application.nativeApplicationVersion ?? undefined,
        deviceModel: Device.modelName ?? undefined,
      });
      return res;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
