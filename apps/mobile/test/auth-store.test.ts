import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../src/auth/auth-store';
import * as tracking from '../src/tracking/tracking';
import * as uploader from '../src/tracking/uploader';
import { setOutboxForTests, setUpdateQueueForTests } from '../src/tracking/store';
import { MemoryOutbox, MemoryUpdateQueue } from './fakes/memory-outbox';

jest.mock('../src/tracking/tracking');
jest.mock('../src/tracking/uploader');

const tokens = (role: string) => ({
  accessToken: 'at',
  refreshToken: 'rt-1',
  user: {
    id: 'u',
    role,
    companyId: 'c',
    name: 'Amit Kumar',
    email: 'amit@demo.worktrail.in',
  },
});
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

beforeEach(() => {
  fetchMock.mockReset();
  jest.clearAllMocks();
  (SecureStore as unknown as { __reset: () => void }).__reset();
  setUpdateQueueForTests(new MemoryUpdateQueue());
  jest.mocked(tracking.stopTracking).mockResolvedValue();
  jest.mocked(uploader.syncNow).mockResolvedValue();
  useAuthStore.setState({ status: 'loading', user: null, accessToken: null });
});

describe('auth store', () => {
  it('signIn stores the refresh token securely and signs in an employee', async () => {
    fetchMock.mockReturnValueOnce(json(tokens('EMPLOYEE')));
    await useAuthStore.getState().signIn('amit@demo.worktrail.in', 'pw');
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'at' });
    expect(await SecureStore.getItemAsync('wt.refresh')).toBe('rt-1');
  });

  it('signs in an admin and keeps their session like an employee', async () => {
    fetchMock.mockReturnValueOnce(json(tokens('OWNER')));
    await useAuthStore.getState().signIn('a@b.in', 'pw');
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn', accessToken: 'at' });
    expect(useAuthStore.getState().user?.role).toBe('OWNER');
    expect(await SecureStore.getItemAsync('wt.refresh')).toBe('rt-1');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no revoke call
  });

  it('register creates the company and owner, then signs them in', async () => {
    fetchMock.mockReturnValueOnce(json(tokens('OWNER')));
    await useAuthStore.getState().register({
      companyName: 'Acme Services',
      name: 'Rahul Shah',
      email: 'rahul@acme.in',
      phone: '+919876543210',
      password: 'StrongPass1',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/signup\/admin$/);
    expect(JSON.parse(init.body)).toMatchObject({ companyName: 'Acme Services', email: 'rahul@acme.in' });
    expect(useAuthStore.getState()).toMatchObject({ status: 'signedIn' });
    expect(await SecureStore.getItemAsync('wt.refresh')).toBe('rt-1');
  });

  it('register passes the server error through (for example an email already in use)', async () => {
    fetchMock.mockReturnValueOnce(
      json({ error: { code: 'EMAIL_TAKEN', message: 'An account with this email already exists. Sign in instead.', details: {} } }, 409),
    );
    await expect(
      useAuthStore.getState().register({
        companyName: 'Acme',
        name: 'Rahul Shah',
        email: 'rahul@acme.in',
        phone: '+919876543210',
        password: 'StrongPass1',
      }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN' });
    expect(useAuthStore.getState().status).not.toBe('signedIn');
    expect(await SecureStore.getItemAsync('wt.refresh')).toBeNull();
  });

  it('bootstrap with no saved token goes to signed out', async () => {
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedOut');
  });

  it('bootstrap restores a saved session via refresh', async () => {
    await SecureStore.setItemAsync('wt.refresh', 'rt-0');
    fetchMock.mockReturnValueOnce(json(tokens('EMPLOYEE')));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedIn');
    expect(await SecureStore.getItemAsync('wt.refresh')).toBe('rt-1');
  });

  it('bootstrap while offline keeps the saved token and shows the offline state', async () => {
    await SecureStore.setItemAsync('wt.refresh', 'rt-0');
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('offline');
    expect(await SecureStore.getItemAsync('wt.refresh')).toBe('rt-0');
  });

  it('a refused refresh (disabled or revoked) signs out and forgets the token', async () => {
    await SecureStore.setItemAsync('wt.refresh', 'rt-0');
    fetchMock.mockReturnValueOnce(
      json({ error: { code: 'SESSION_EXPIRED', message: 'x', details: {} } }, 401),
    );
    await useAuthStore.getState().bootstrap();
    expect(useAuthStore.getState().status).toBe('signedOut');
    expect(await SecureStore.getItemAsync('wt.refresh')).toBeNull();
  });

  it('sign out stops tracking, tries a last upload and wipes the phone queue', async () => {
    const box = new MemoryOutbox();
    const updateQueue = new MemoryUpdateQueue();
    setOutboxForTests(box);
    setUpdateQueueForTests(updateQueue);
    await box.insert([{ clientPointId: 'a', sessionId: 's', payload: { clientPointId: 'a', latitude: 1, longitude: 1, capturedAt: '2026-10-06T05:00:00Z' }, attempts: 0, nextAttemptAt: 0 }]);
    await updateQueue.add({ clientUpdateId: 'u1', payload: { clientUpdateId: 'u1', sessionId: 's', text: 'Hello', inputMethod: 'TYPED', submittedAt: '2026-10-06T05:00:00Z' }, attempts: 0, nextAttemptAt: 0 });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await useAuthStore.getState().signOut();
    expect(tracking.stopTracking).toHaveBeenCalled();
    expect(await box.count()).toBe(0);
    expect(await updateQueue.count()).toBe(0);
  });
});
