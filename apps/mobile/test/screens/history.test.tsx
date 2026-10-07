import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HistoryScreen from '../../src/app/(app)/history';
import { groupHistory } from '../../src/updates/use-history';
import { setUpdateQueueForTests } from '../../src/tracking/store';
import { MemoryUpdateQueue } from '../fakes/memory-outbox';

const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
const TZ = 'Asia/Kolkata';

const history = {
  timezone: TZ,
  sessions: [
    { id: 's2', status: 'COMPLETED', startedAt: '2026-10-05T03:32:00.000Z', endedAt: '2026-10-05T12:40:00.000Z', totalMinutes: 548, lastLocationAt: null },
    { id: 's1', status: 'COMPLETED', startedAt: '2026-10-04T18:00:00.000Z', endedAt: '2026-10-04T19:00:00.000Z', totalMinutes: 60, lastLocationAt: null },
  ],
  updates: [
    { id: 'u1', clientUpdateId: 'c1', sessionId: 's2', text: 'Completed installation.', inputMethod: 'VOICE', category: 'INSTALLATION', submittedAt: '2026-10-05T06:00:00.000Z', summaryStatus: 'QUEUED' },
  ],
};

describe('history', () => {
  it('splits an overnight session across both days with the right minutes', () => {
    const days = groupHistory(history as never, [], ['2026-10-05', '2026-10-04']);
    expect(days[0]!.sessions.find((s) => s.id === 's1')?.minutesThatDay).toBe(30);
    expect(days[1]!.sessions.find((s) => s.id === 's1')?.minutesThatDay).toBe(30);
  });

  it('shows queued updates as waiting, and never twice once sent', () => {
    const queued = [
      { clientUpdateId: 'c9', payload: { clientUpdateId: 'c9', sessionId: 's2', text: 'Offline note.', inputMethod: 'TYPED', submittedAt: '2026-10-05T07:00:00.000Z' }, attempts: 1, nextAttemptAt: 0 },
      { clientUpdateId: 'c1', payload: { clientUpdateId: 'c1', sessionId: 's2', text: 'Completed installation.', inputMethod: 'VOICE', submittedAt: '2026-10-05T06:00:00.000Z' }, attempts: 1, nextAttemptAt: 0 },
    ];
    const day = groupHistory(history as never, queued as never, ['2026-10-05'])[0]!;
    expect(day.updates.map((u) => [u.clientUpdateId, u.waiting])).toEqual([['c9', true], ['c1', false]]);
  });

  it('renders days with sessions and updates', async () => {
    setUpdateQueueForTests(new MemoryUpdateQueue());
    fetchMock.mockResolvedValue(new Response(JSON.stringify(history)));
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><HistoryScreen /></QueryClientProvider>);
    expect(await screen.findByText('9:02 AM – 6:10 PM · 9h 8m')).toBeOnTheScreen();
    const update = screen.getByText('Completed installation.');
    expect(update).toBeOnTheScreen();
    expect(screen.getByText(/Installation · Spoken/)).toBeOnTheScreen();
    expect(screen.getByText('Summary on the way')).toBeOnTheScreen();
  });

  it('shows AI summary for COMPLETE, and handles FAILED', async () => {
    setUpdateQueueForTests(new MemoryUpdateQueue());
    const mockData = {
      timezone: TZ,
      sessions: [],
      updates: [
        {
          id: 'u1',
          clientUpdateId: 'c1',
          sessionId: 's1',
          text: 'First update text.',
          inputMethod: 'TYPED',
          category: null,
          submittedAt: '2026-10-05T06:00:00.000Z',
          summaryStatus: 'COMPLETE',
          aiSummary: {
            summary: 'Installed first machine.',
            activities: ['Installation'],
            issues: [],
            followUps: [],
            confidence: 'HIGH',
          },
        },
        {
          id: 'u2',
          clientUpdateId: 'c2',
          sessionId: 's1',
          text: 'Second update text.',
          inputMethod: 'TYPED',
          category: null,
          submittedAt: '2026-10-05T07:00:00.000Z',
          summaryStatus: 'FAILED',
          aiSummary: null,
        },
      ],
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(mockData)));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <HistoryScreen />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Installed first machine.')).toBeOnTheScreen();
    expect(screen.getByText('AI summary')).toBeOnTheScreen();
    expect(screen.getByText('Summary unavailable')).toBeOnTheScreen();
  });
});
