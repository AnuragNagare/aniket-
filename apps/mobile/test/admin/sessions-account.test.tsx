import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { WorkSessionRow } from '@worktrail/types';
import * as hooks from '../../src/admin/hooks';
import AccountScreen from '../../src/app/(admin)/account';
import SessionsScreen from '../../src/app/(admin)/sessions';
import { useAuthStore } from '../../src/auth/auth-store';

jest.mock('../../src/admin/hooks');
jest.mock('../../src/admin/use-company', () => ({
  useCompanyDay: () => ({ tz: 'Asia/Kolkata', today: '2026-10-07', companyName: 'Acme Services' }),
}));

const q = (over: object) => ({ data: undefined, isLoading: false, isError: false, error: null, refetch: jest.fn(), isRefetching: false, ...over });
const row = (over: Partial<WorkSessionRow>): WorkSessionRow => ({
  id: 's1', employeeId: 'e1', employeeName: 'Amit Kumar', status: 'COMPLETED', startedAt: '2026-10-07T03:32:00.000Z',
  endedAt: '2026-10-07T12:40:00.000Z', totalMinutes: 548, lastLocationAt: null, pointCount: 110, leftRunning: false, ...over,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(hooks.useCloseSession).mockReturnValue({ mutateAsync: jest.fn(), isPending: false } as never);
});
afterEach(() => jest.useRealTimers());

describe('Sessions screen', () => {
  it('lists every employee’s sessions for the chosen period', () => {
    jest.mocked(hooks.useWorkSessions).mockReturnValue(q({ data: { timezone: 'Asia/Kolkata', page: 1, pageSize: 25, total: 2, items: [row({}), row({ id: 's2', employeeName: 'Vikram Rao', status: 'ACTIVE', endedAt: null, totalMinutes: null, leftRunning: true })] } }) as never);
    render(<SessionsScreen />);
    expect(screen.getByText('Amit Kumar')).toBeOnTheScreen();
    expect(screen.getByText('Vikram Rao')).toBeOnTheScreen();
    // 'Left running' is both a filter chip and the label on Vikram's session.
    expect(screen.getAllByText('Left running')).toHaveLength(2);
    expect(hooks.useWorkSessions).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-10-07', to: '2026-10-07', page: 1 }));
  });

  it('only offers Close session on an open session', () => {
    jest.mocked(hooks.useWorkSessions).mockReturnValue(q({ data: { timezone: 'Asia/Kolkata', page: 1, pageSize: 25, total: 2, items: [row({}), row({ id: 's2', status: 'ACTIVE', endedAt: null, totalMinutes: null })] } }) as never);
    render(<SessionsScreen />);
    expect(screen.getAllByRole('button', { name: 'Close session' })).toHaveLength(1);
  });

  it('filters by status and period', () => {
    jest.mocked(hooks.useWorkSessions).mockReturnValue(q({ data: { timezone: 'Asia/Kolkata', page: 1, pageSize: 25, total: 0, items: [] } }) as never);
    render(<SessionsScreen />);
    expect(screen.getByText('No work sessions in this period.')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Left running' }));
    expect(hooks.useWorkSessions).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'LEFT_RUNNING', page: 1 }));
    fireEvent.press(screen.getByRole('button', { name: 'This week' }));
    expect(hooks.useWorkSessions).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-05', to: '2026-10-07' }));
  });

  it('searches by employee name after typing stops', () => {
    jest.mocked(hooks.useWorkSessions).mockReturnValue(q({ data: { timezone: 'Asia/Kolkata', page: 1, pageSize: 25, total: 0, items: [] } }) as never);
    render(<SessionsScreen />);
    fireEvent.changeText(screen.getByLabelText('Search by employee'), 'neha');
    act(() => void jest.advanceTimersByTime(450));
    expect(hooks.useWorkSessions).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'neha' }));
  });

  it('shows loading and error states', () => {
    jest.mocked(hooks.useWorkSessions).mockReturnValue(q({ isLoading: true }) as never);
    const { unmount } = render(<SessionsScreen />);
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    unmount();
    jest.mocked(hooks.useWorkSessions).mockReturnValue(q({ isError: true, error: new Error('x') }) as never);
    render(<SessionsScreen />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});

describe('Account screen', () => {
  const signOut = jest.fn();
  beforeEach(() => {
    jest.useRealTimers();
    signOut.mockReset().mockResolvedValue(undefined);
    useAuthStore.setState({ signOut, user: { id: 'u', role: 'OWNER', companyId: 'c', name: 'Rahul Shah', email: 'rahul@acme.in' } });
  });

  it('shows who is signed in, their role and company', () => {
    render(<AccountScreen />);
    expect(screen.getByText('Rahul Shah')).toBeOnTheScreen();
    expect(screen.getByText('rahul@acme.in')).toBeOnTheScreen();
    expect(screen.getByText('Owner')).toBeOnTheScreen();
    expect(screen.getByText('Acme Services')).toBeOnTheScreen();
  });

  it('asks before signing out, then signs out', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => void buttons?.find((b) => b.style === 'destructive')?.onPress?.());
    render(<AccountScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(alert).toHaveBeenCalled();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
  });

  it('does not sign out when the admin cancels', () => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<AccountScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).not.toHaveBeenCalled();
  });

  it('points to the website for the features that are not in the app', () => {
    render(<AccountScreen />);
    expect(screen.getByText(/PDF reports, company settings/)).toBeOnTheScreen();
  });
});
