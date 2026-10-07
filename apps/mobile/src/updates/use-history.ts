import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import type { HistoryResponse, WorkSessionDto, WorkUpdateDto } from '@worktrail/types';
import { api } from '../api';
import type { QueuedUpdate } from '../tracking/outbox';
import { getUpdateQueue } from '../tracking/store';

export type HistoryDay = {
  date: string;
  label: string;
  sessions: Array<WorkSessionDto & { minutesThatDay: number }>;
  updates: Array<WorkUpdateDto & { waiting: boolean }>;
};

const dayStart = (date: string, tz: string) =>
  Date.parse(formatInTimeZone(new Date(`${date}T12:00:00Z`), tz, "yyyy-MM-dd'T'00:00:00XXX"));

export function groupHistory(h: HistoryResponse, queued: QueuedUpdate[], days: string[]): HistoryDay[] {
  const sentIds = new Set(h.updates.map((u) => u.clientUpdateId));
  const waiting: Array<WorkUpdateDto & { waiting: boolean }> = queued
    .filter((q) => !sentIds.has(q.clientUpdateId))
    .map((q) => ({
      id: q.clientUpdateId,
      clientUpdateId: q.clientUpdateId,
      sessionId: q.payload.sessionId,
      text: q.payload.text,
      inputMethod: q.payload.inputMethod,
      category: q.payload.category ?? null,
      submittedAt: q.payload.submittedAt,
      summaryStatus: 'QUEUED',
      aiSummary: null,
      waiting: true,
    }));
  const allUpdates = [...waiting, ...h.updates.map((u) => ({ ...u, waiting: false }))].sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt),
  );

  return days.map((date) => {
    const from = dayStart(date, h.timezone);
    const to = from + 86_400_000;
    const now = Date.now();
    const sessions = h.sessions
      .map((s) => {
        const a = Math.max(Date.parse(s.startedAt), from);
        const b = Math.min(s.endedAt ? Date.parse(s.endedAt) : now, to);
        return { ...s, minutesThatDay: Math.max(0, Math.round((b - a) / 60_000)) };
      })
      .filter((s) => s.minutesThatDay > 0 || (Date.parse(s.startedAt) >= from && Date.parse(s.startedAt) < to));
    const updates = allUpdates.filter((u) => {
      const t = Date.parse(u.submittedAt);
      return t >= from && t < to;
    });
    const label = formatInTimeZone(new Date(from), h.timezone, 'EEE d MMM');
    return { date, label, sessions, updates };
  });
}

/** Last `days` days of my sessions and updates, newest day first, including updates still on the phone. */
export function useHistory(days = 14) {
  return useQuery({
    queryKey: ['history', days],
    queryFn: async () => {
      const today = new Date();
      const dates = Array.from({ length: days }, (_, i) =>
        formatInTimeZone(new Date(today.getTime() - i * 86_400_000), 'Asia/Kolkata', 'yyyy-MM-dd'),
      );
      const h = await api.request<HistoryResponse>('GET', `/me/history?from=${dates.at(-1)}&to=${dates[0]}`);
      const queued = await (await getUpdateQueue()).list();
      return groupHistory(h, queued, dates).filter((d) => d.sessions.length || d.updates.length);
    },
    refetchInterval: (q) =>
      q.state.data?.some((d) =>
        d.updates.some((u) => u.summaryStatus === 'QUEUED' || u.summaryStatus === 'PROCESSING'),
      )
        ? 20_000
        : false,
  });
}
