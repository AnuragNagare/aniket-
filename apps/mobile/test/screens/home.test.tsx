import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as location from '../../src/location/location';
import * as tracking from '../../src/tracking/tracking';
import HomeScreen from '../../src/app/(app)/index';
import { useAuthStore } from '../../src/auth/auth-store';
import { mockRouter } from '../mocks/expo-router';
import { readPendingEnd, savePendingEnd } from '../../src/tracking/pending-end';
import { setOutboxForTests } from '../../src/tracking/store';
import { MemoryOutbox } from '../fakes/memory-outbox';

jest.mock('../../src/location/location');
jest.mock('../../src/tracking/tracking');
jest.mock('../../src/tracking/uploader');

const loc = location as jest.Mocked<typeof location>;
const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const fix = {
  clientPointId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
  latitude: 19.07,
  longitude: 72.87,
  accuracyMeters: 12,
  capturedAt: new Date().toISOString(),
  batteryLevel: 0.5,
};
const session = (startedAt: string) => ({
  id: 's1',
  status: 'ACTIVE',
  startedAt,
  endedAt: null,
  totalMinutes: null,
  lastLocationAt: startedAt,
});
const meResponse = {
  user: {
    id: 'u',
    role: 'EMPLOYEE',
    companyId: 'c',
    name: 'Amit Kumar',
    email: 'amit@demo.worktrail.in',
  },
  employee: {
    id: 'e',
    name: 'Amit Kumar',
    designation: 'Field Sales Executive',
    employeeCode: 'FT-101',
    phone: null,
  },
  company: { name: 'Demo Field Services Pvt Ltd', timezone: 'Asia/Kolkata' },
};

function renderHome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <HomeScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  jest.clearAllMocks();
  setOutboxForTests(new MemoryOutbox());
  jest.mocked(tracking.startTracking).mockResolvedValue('background');
  jest.mocked(tracking.reconcileTracking).mockResolvedValue();
  jest.mocked(tracking.stopTracking).mockResolvedValue();
  jest.mocked(tracking.getTrackingStatus).mockResolvedValue({
    mode: 'background',
    pending: 0,
    lastSentAt: null,
    pendingEnd: false,
  });
  useAuthStore.setState({
    status: 'signedIn',
    accessToken: 'at',
    user: {
      id: 'u',
      role: 'EMPLOYEE',
      companyId: 'c',
      name: 'Amit Kumar',
      email: 'amit@demo.worktrail.in',
    },
  });
});

describe('Home', () => {
  it('off duty: Start work captures a location and starts the session', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      if (url.endsWith('/sessions/start')) {
        return json(
          { session: session(new Date().toISOString()), serverTime: new Date().toISOString() },
          201,
        );
      }
      return json({ session: null, serverTime: new Date().toISOString() });
    });
    loc.currentFix.mockResolvedValue({ ok: true, fix });
    renderHome();
    expect(await screen.findByText('Ready to start your day?')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Start work' }));
    expect(await screen.findByText('At work')).toBeOnTheScreen();
    const startCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/sessions/start'));
    const body = JSON.parse(String(startCall?.[1]?.body));
    expect(body.initialLocation.clientPointId).toBe(fix.clientPointId);
  });

  it('sends people to the disclosure screen when location permission is missing', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      return json({ session: null, serverTime: new Date().toISOString() });
    });
    loc.currentFix.mockResolvedValue({ ok: false, reason: 'PERMISSION' });
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Start work' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/permissions'));
  });

  it('warns when phone location services are turned off', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      return json({ session: null, serverTime: new Date().toISOString() });
    });
    loc.currentFix.mockResolvedValue({ ok: false, reason: 'SERVICES_OFF' });
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Start work' }));
    expect(await screen.findByText(/Turn on location/)).toBeOnTheScreen();
  });

  it('adopts a session that was already active (e.g. from another tab)', async () => {
    const running = session(new Date().toISOString());
    let startAttempted = false;
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      if (url.endsWith('/sessions/start')) {
        startAttempted = true;
        return json(
          {
            error: {
              code: 'SESSION_ALREADY_ACTIVE',
              message: 'x',
              details: { session: running },
            },
          },
          409,
        );
      }
      if (startAttempted) {
        return json({ session: running, serverTime: new Date().toISOString() });
      }
      return json({ session: null, serverTime: new Date().toISOString() });
    });
    loc.currentFix.mockResolvedValue({ ok: true, fix });
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Start work' }));
    expect(await screen.findByText('At work')).toBeOnTheScreen();
  });

  it('at work: shows the timer from server time and ends work after confirming', async () => {
    const started = new Date(Date.now() - 65 * 60_000).toISOString();
    let ended = false;
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      if (url.endsWith('/sessions/s1/end')) {
        ended = true;
        return json({
          session: { ...session(started), status: 'COMPLETED' },
          serverTime: new Date().toISOString(),
        });
      }
      if (ended) {
        return json({ session: null, serverTime: new Date().toISOString() });
      }
      return json({ session: session(started), serverTime: new Date().toISOString() });
    });
    loc.currentFix.mockResolvedValue({ ok: true, fix });
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, buttons) =>
        buttons?.find((b) => b.text === 'End work')?.onPress?.(),
      );
    renderHome();
    expect(await screen.findByText(/^1:0[45]:\d\d$/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'End work' }));
    expect(await screen.findByText('Ready to start your day?')).toBeOnTheScreen();
    const endCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/sessions/s1/end'));
    expect(endCall).toBeDefined();
    const endBody = JSON.parse(String(endCall?.[1]?.body));
    expect(endBody).toHaveProperty('endedAt');
  });

  it('offers to end a session left running from an earlier day', async () => {
    const yesterday = new Date(Date.now() - 26 * 3600_000).toISOString();
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      return json({ session: session(yesterday), serverTime: new Date().toISOString() });
    });
    renderHome();
    expect(await screen.findByText(/haven’t ended it/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Keep working' })).toBeOnTheScreen();
  });

  it('shows a retry when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    renderHome();
    expect(
      await screen.findByText(
        'You appear to be offline. Check your connection and try again.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });

  it('ending work with no signal ends it now and promises to send it later', async () => {
    const started = new Date(Date.now() - 30 * 60_000).toISOString();
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      if (url.endsWith('/end')) return Promise.reject(new TypeError('Network request failed'));
      return json({ session: session(started), serverTime: new Date().toISOString() });
    });
    loc.currentFix.mockResolvedValue({ ok: false, reason: 'NO_FIX' });
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, buttons) =>
        buttons?.find((b) => b.text === 'End work')?.onPress?.(),
      );
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'End work' }));
    expect(
      await screen.findByText('Work ended. We’ll send it to your company when you’re back online.'),
    ).toBeOnTheScreen();
    expect(tracking.stopTracking).toHaveBeenCalled();
    expect(await readPendingEnd()).toMatchObject({ sessionId: 's1' });
  });

  it('a queued end keeps the screen off duty even though the server still says at work', async () => {
    await savePendingEnd({
      sessionId: 's1',
      body: { deviceTime: new Date().toISOString() },
    });
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      return json({
        session: session(new Date().toISOString()),
        serverTime: new Date().toISOString(),
      });
    });
    renderHome();
    expect(await screen.findByText('Ready to start your day?')).toBeOnTheScreen();
  });

  it('starting work starts background tracking for the new session', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      if (url.endsWith('/sessions/start')) {
        return json(
          { session: session(new Date().toISOString()), serverTime: new Date().toISOString() },
          201,
        );
      }
      return json({ session: null, serverTime: new Date().toISOString() });
    });
    loc.currentFix.mockResolvedValue({ ok: true, fix });
    renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Start work' }));
    await waitFor(() => expect(tracking.startTracking).toHaveBeenCalledWith('s1'));
  });

  it('at work: offers Add update; off duty: explains it needs a session', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      return json({ session: session(new Date().toISOString()), serverTime: new Date().toISOString() });
    });
    const { unmount } = renderHome();
    fireEvent.press(await screen.findByRole('button', { name: 'Add update' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/update');
    unmount();
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(meResponse);
      return json({ session: null, serverTime: new Date().toISOString() });
    });
    renderHome();
    expect(await screen.findByText('Start work to add updates.')).toBeOnTheScreen();
  });
});
