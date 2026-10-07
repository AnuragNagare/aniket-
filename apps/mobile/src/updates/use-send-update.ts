import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import type { CreateUpdateInput, CreateUpdateResponse, InputMethod, UpdateCategory } from '@worktrail/types';
import { api, ApiError } from '../api';
import { ACTIVE_SESSION_KEY } from '../sessions/use-work-session';
import { getUpdateQueue } from '../tracking/store';
import { syncNow } from '../tracking/uploader';

type ActiveView = { session: { id: string } | null; offsetMs: number };

/** Sends an update now, or keeps it on the phone when there's no signal. */
export function useSendUpdate() {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);

  async function send(input: { text: string; inputMethod: InputMethod; category?: UpdateCategory }): Promise<'sent' | 'queued'> {
    const active = qc.getQueryData<ActiveView>(ACTIVE_SESSION_KEY);
    if (!active?.session) throw new ApiError(409, 'SESSION_NOT_ACTIVE', 'Start work before adding an update.');
    const payload: CreateUpdateInput = {
      clientUpdateId: randomUUID(),
      sessionId: active.session.id,
      text: input.text.trim(),
      inputMethod: input.inputMethod,
      category: input.category,
      submittedAt: new Date(Date.now() + active.offsetMs).toISOString(),
    };
    setSending(true);
    try {
      await api.request<CreateUpdateResponse>('POST', '/updates', payload);
      await qc.invalidateQueries({ queryKey: ['history'] });
      return 'sent';
    } catch (e) {
      if (e instanceof ApiError && e.code === 'NETWORK') {
        await (await getUpdateQueue()).add({ clientUpdateId: payload.clientUpdateId, payload, attempts: 1, nextAttemptAt: 0 });
        void syncNow().catch(() => undefined);
        return 'queued';
      }
      throw e;
    } finally {
      setSending(false);
    }
  }

  return { send, sending };
}
