import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { mockRouter } from '../mocks/expo-router';
import type { DashboardResponse } from '@worktrail/types';
import Dashboard from '../../src/app/(admin)/index';
import { useAuthStore } from '../../src/auth/auth-store';
import * as hooks from '../../src/admin/hooks';

jest.mock('../../src/admin/hooks');
jest.mock('../../src/admin/use-company', () => ({
  useCompanyDay: () => ({ tz: 'Asia/Kolkata', today: '2026-10-07', companyName: 'Acme Services' }),
}));

const data: DashboardResponse = {
  date: '2026-10-07',
  timezone: 'Asia/Kolkata',
  kpis: { totalEmployees: 5, workingNow: 3, checkedInToday: 4, workMinutesToday: 1530, workMinutesYesterday: 1400, updatesToday: 6, updatesYesterday: 4 },
  locations: [],
  recentUpdates: [
    { id: 'u1', employeeId: 'e1', employeeName: 'Amit Kumar', text: 'Met the purchase manager at ABC Traders.', submittedAt: '2026-10-07T04:30:00.000Z', category: 'CLIENT_MEETING', inputMethod: 'VOICE', summary: 'Met ABC Traders manager.' },
  ],
  workHours: [],
};
const query = (over: object) => ({ data: undefined, isLoading: false, isError: false, error: null, refetch: jest.fn(), isRefetching: false, ...over });
const useDashboard = jest.mocked(hooks.useDashboard);

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u', role: 'OWNER', companyId: 'c', name: 'Rahul Shah', email: 'r@a.in' } });
});

describe('Admin dashboard', () => {
  it('shows a loading state first', () => {
    useDashboard.mockReturnValue(query({ isLoading: true }) as never);
    render(<Dashboard />);
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
  });

  it('shows the greeting, the KPI numbers and recent updates with the AI summary', () => {
    useDashboard.mockReturnValue(query({ data }) as never);
    render(<Dashboard />);
    expect(screen.getByText('Hello, Rahul')).toBeOnTheScreen();
    expect(screen.getByLabelText('Working now: 3')).toBeOnTheScreen();
    expect(screen.getByLabelText('Total employees: 5')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hours today: 25h 30m')).toBeOnTheScreen();
    expect(screen.getByLabelText('Updates today: 6')).toBeOnTheScreen();
    expect(screen.getByText('Met the purchase manager at ABC Traders.')).toBeOnTheScreen();
    expect(screen.getByText('Met ABC Traders manager.')).toBeOnTheScreen();
  });

  it('explains an empty day', () => {
    useDashboard.mockReturnValue(query({ data: { ...data, recentUpdates: [] } }) as never);
    render(<Dashboard />);
    expect(screen.getByText('No updates for this day yet.')).toBeOnTheScreen();
  });

  it('shows the error with a retry', () => {
    const refetch = jest.fn();
    useDashboard.mockReturnValue(query({ isError: true, error: new Error('x'), refetch }) as never);
    render(<Dashboard />);
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('can look at yesterday', () => {
    useDashboard.mockReturnValue(query({ data }) as never);
    render(<Dashboard />);
    fireEvent.press(screen.getByRole('button', { name: 'Yesterday' }));
    expect(useDashboard).toHaveBeenLastCalledWith('2026-10-06');
  });
  it('opens the matching screen when a card is tapped', () => {
    useDashboard.mockReturnValue(query({ data }) as never);
    render(<Dashboard />);
    fireEvent.press(screen.getByLabelText('Total employees: 5'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/employees');
    fireEvent.press(screen.getByLabelText('Working now: 3'));
    expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/employees', params: { status: 'WORKING' } });
    fireEvent.press(screen.getByLabelText('Hours today: 25h 30m'));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/sessions');
  });

  it('has an Add employee button that opens the invite screen', () => {
    useDashboard.mockReturnValue(query({ data }) as never);
    render(<Dashboard />);
    fireEvent.press(screen.getByRole('button', { name: 'Add employee' }));
    expect(mockRouter.push).toHaveBeenLastCalledWith('/employees/invite');
  });

  it('asks before signing out from the dashboard', () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ signOut });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => void buttons?.find((b) => b.style === 'destructive')?.onPress?.());
    useDashboard.mockReturnValue(query({ data }) as never);
    render(<Dashboard />);
    fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(alert).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });
});
