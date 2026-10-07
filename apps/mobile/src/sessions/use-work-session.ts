import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActiveSessionResponse,
  SessionMutationResponse,
  WorkSessionDto,
} from '@worktrail/types';
import { api, ApiError } from '../api';
import { currentFix } from '../location/location';
import { clearPendingEnd, readPendingEnd, savePendingEnd } from '../tracking/pending-end';
import { reconcileTracking, startTracking, stopTracking, type TrackingMode } from '../tracking/tracking';
import { syncNow } from '../tracking/uploader';

export const ACTIVE_SESSION_KEY = ['sessions', 'active'] as const;

type ActiveView = { session: WorkSessionDto | null; offsetMs: number; pendingEnd?: boolean };

export class NeedsPermissionError extends Error {}
export class LocationOffError extends Error {}

const toView = (r: ActiveSessionResponse | SessionMutationResponse): ActiveView => ({
  session: r.session,
  offsetMs: Date.parse(r.serverTime) - Date.now(),
});

async function fetchActive(): Promise<ActiveView> {
  const view = toView(await api.request<ActiveSessionResponse>('GET', '/sessions/me/active'));
  const pending = await readPendingEnd();
  if (pending && view.session?.id === pending.sessionId) {
    // The end is queued but not delivered yet: the employee has already stopped work.
    void Promise.resolve(syncNow()).catch(() => undefined);
    return { ...view, session: null, pendingEnd: true };
  }
  if (pending) await clearPendingEnd(); // server already shows it ended
  await Promise.resolve(reconcileTracking(view.session?.id ?? null)).catch(() => undefined);
  return view;
}

export function useWorkSession() {
  const qc = useQueryClient();
  const [startNote, setStartNote] = useState<string | null>(null);
  const [lastStartMode, setLastStartMode] = useState<TrackingMode | null>(null);
  const active = useQuery({ queryKey: ACTIVE_SESSION_KEY, queryFn: fetchActive });

  const start = useMutation({
    mutationFn: async (): Promise<ActiveView> => {
      setStartNote(null);
      const fix = await currentFix();
      if (!fix.ok && fix.reason === 'PERMISSION') throw new NeedsPermissionError();
      if (!fix.ok && fix.reason === 'SERVICES_OFF') throw new LocationOffError();
      if (!fix.ok)
        setStartNote(
          'Work started, but your location couldn’t be found. Move near a window or outside so your end location is recorded.',
        );
      let view: ActiveView;
      try {
        view = toView(
          await api.request<SessionMutationResponse>('POST', '/sessions/start', {
            deviceTime: new Date().toISOString(),
            initialLocation: fix.ok ? fix.fix : undefined,
          }),
        );
      } catch (e) {
        // Already running (double tap or retry): show that session instead of an error.
        if (e instanceof ApiError && e.code === 'SESSION_ALREADY_ACTIVE') {
          view = await fetchActive();
        } else {
          throw e;
        }
      }
      if (view.session?.id) {
        const mode = await startTracking(view.session.id);
        setLastStartMode(mode);
      }
      return view;
    },
    onSuccess: (view) => qc.setQueryData(ACTIVE_SESSION_KEY, view),
  });

  const end = useMutation({
    mutationFn: async (sessionId: string): Promise<ActiveView> => {
      await Promise.resolve(stopTracking()).catch(() => undefined); // stop recording the moment End is tapped
      const offsetMs = qc.getQueryData<ActiveView>(ACTIVE_SESSION_KEY)?.offsetMs ?? 0;
      const fix = await currentFix(5_000);
      const body = {
        deviceTime: new Date().toISOString(),
        endedAt: new Date(Date.now() + offsetMs).toISOString(),
        finalLocation: fix.ok ? fix.fix : undefined,
      };
      try {
        await api.request<SessionMutationResponse>('POST', `/sessions/${sessionId}/end`, body);
      } catch (e) {
        if (e instanceof ApiError && e.code === 'NETWORK') {
          await savePendingEnd({ sessionId, body });
          return { session: null, offsetMs, pendingEnd: true };
        }
        if (!(e instanceof ApiError && e.code === 'SESSION_NOT_ACTIVE')) throw e;
      }
      void Promise.resolve(syncNow()).catch(() => undefined);
      return fetchActive();
    },
    onSuccess: (view) => qc.setQueryData(ACTIVE_SESSION_KEY, view),
  });

  return {
    session: active.data?.session ?? null,
    offsetMs: active.data?.offsetMs ?? 0,
    pendingEnd: active.data?.pendingEnd ?? false,
    lastStartMode,
    isLoading: active.isLoading,
    error: (active.error as ApiError | null) ?? null,
    refetch: active.refetch,
    start: start.mutateAsync,
    starting: start.isPending,
    end: end.mutateAsync,
    ending: end.isPending,
    startNote,
  };
}
