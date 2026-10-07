import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as location from '../../src/location/location';
import ProfileScreen from '../../src/app/(app)/profile';
import { useAuthStore } from '../../src/auth/auth-store';

import * as tracking from '../../src/tracking/tracking';
import { setOutboxForTests } from '../../src/tracking/store';
import { MemoryOutbox } from '../fakes/memory-outbox';

jest.mock('../../src/location/location');
jest.mock('../../src/tracking/tracking');
jest.mock('../../src/tracking/uploader');
const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const me = {
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
    phone: '+919800000110',
  },
  company: { name: 'Demo Field Services Pvt Ltd', timezone: 'Asia/Kolkata' },
};

function renderProfile() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ProfileScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  jest.clearAllMocks();
  setOutboxForTests(new MemoryOutbox());
  jest.mocked(tracking.stopTracking).mockResolvedValue();
  jest.mocked(tracking.reconcileTracking).mockResolvedValue();
  (location.currentFix as jest.Mock).mockResolvedValue({ ok: false, reason: 'NO_FIX' });
});

describe('Profile', () => {
  it('shows who you are and where you work', async () => {
    const signOut = jest.fn();
    useAuthStore.setState({ signOut });
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/me')
        ? json(me)
        : json({ session: null, serverTime: new Date().toISOString() }),
    );
    renderProfile();
    expect(await screen.findByText('Field Sales Executive')).toBeOnTheScreen();
    expect(screen.getByText('Demo Field Services Pvt Ltd')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('ends work before signing out when a session is running', async () => {
    const signOut = jest.fn();
    useAuthStore.setState({ signOut });
    const running = {
      id: 's1',
      status: 'ACTIVE',
      startedAt: new Date().toISOString(),
      endedAt: null,
      totalMinutes: null,
      lastLocationAt: null,
    };
    fetchMock.mockImplementation((url: string) => {
      if (url.endsWith('/me')) return json(me);
      if (url.endsWith('/sessions/s1/end')) {
        return json({
          session: { ...running, status: 'COMPLETED' },
          serverTime: new Date().toISOString(),
        });
      }
      return json({ session: running, serverTime: new Date().toISOString() });
    });
    jest
      .spyOn(Alert, 'alert')
      .mockImplementation((_t, _m, buttons) =>
        buttons?.find((b) => b.text === 'End work and sign out')?.onPress?.(),
      );
    renderProfile();
    expect(await screen.findByText('Field Sales Executive')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/sessions/s1/end'))).toBe(true);
  });
});
