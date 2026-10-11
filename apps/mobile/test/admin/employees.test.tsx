import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import type { EmployeeListItem } from '@worktrail/types';
import * as hooks from '../../src/admin/hooks';
import EmployeesScreen from '../../src/app/(admin)/employees/index';
import { mockRouter } from '../mocks/expo-router';

jest.mock('../../src/admin/hooks');
jest.mock('../../src/admin/use-company', () => ({
  useCompanyDay: () => ({ tz: 'Asia/Kolkata', today: '2026-10-07', companyName: 'Acme Services' }),
}));

const emp = (over: Partial<EmployeeListItem>): EmployeeListItem => ({
  id: 'e1', name: 'Amit Kumar', designation: 'Field Sales Executive', employeeCode: null, email: 'amit@acme.in', status: 'WORKING', account: 'ACTIVE', ...over,
});
const query = (over: object) => ({ data: undefined, isLoading: false, isError: false, error: null, refetch: jest.fn(), isRefetching: false, ...over });
const useEmployees = jest.mocked(hooks.useEmployees);
const resend = { mutateAsync: jest.fn() };

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(hooks.useResendInvite).mockReturnValue(resend as never);
});
afterEach(() => jest.useRealTimers());

describe('Employees screen', () => {
  it('lists employees with their status and opens one', () => {
    useEmployees.mockReturnValue(query({ data: { items: [emp({}), emp({ id: 'e2', name: 'Neha Patel', status: 'OFF_DUTY' })], page: 1, pageSize: 20, total: 2 } }) as never);
    render(<EmployeesScreen />);
    // 'Working' and 'Off duty' are also filter chips, so look for the status pills (non-button text).
    expect(screen.getAllByText('Working')).toHaveLength(2);
    expect(screen.getAllByText('Off duty')).toHaveLength(2);
    fireEvent.press(screen.getByRole('button', { name: 'Open Neha Patel' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/employees/e2');
  });

  it('shows an invited person with a Resend link button, and shares the new link', async () => {
    useEmployees.mockReturnValue(query({ data: { items: [emp({ id: 'e3', name: 'Ravi Kumar', account: 'INVITED' })], page: 1, pageSize: 20, total: 1 } }) as never);
    resend.mutateAsync.mockResolvedValue({ employeeId: 'e3', inviteUrl: 'https://x/invite/abc', expiresAt: 'z', emailSent: true });
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    render(<EmployeesScreen />);
    expect(screen.getByText('Invited, not joined yet')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Resend link to Ravi Kumar' }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(resend.mutateAsync).toHaveBeenCalledWith('e3');
    expect(share.mock.calls[0]![0]!.message).toContain('https://x/invite/abc');
  });

  it('has an Invite employee button', () => {
    useEmployees.mockReturnValue(query({ data: { items: [], page: 1, pageSize: 20, total: 0 } }) as never);
    render(<EmployeesScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Invite employee' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/employees/invite');
  });

  it('explains an empty company and an empty search differently', () => {
    useEmployees.mockReturnValue(query({ data: { items: [], page: 1, pageSize: 20, total: 0 } }) as never);
    render(<EmployeesScreen />);
    expect(screen.getByText(/No employees yet/)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Working' }));
    expect(screen.getByText('No employees match.')).toBeOnTheScreen();
  });

  it('searches after typing stops, and filters by status', () => {
    useEmployees.mockReturnValue(query({ data: { items: [], page: 1, pageSize: 20, total: 0 } }) as never);
    render(<EmployeesScreen />);
    fireEvent.changeText(screen.getByLabelText('Search by name'), 'ami');
    expect(useEmployees).not.toHaveBeenCalledWith(expect.objectContaining({ query: 'ami' }));
    act(() => void jest.advanceTimersByTime(450));
    expect(useEmployees).toHaveBeenLastCalledWith({ query: 'ami', status: undefined, page: 1 });
    fireEvent.press(screen.getByRole('button', { name: 'Working' }));
    expect(useEmployees).toHaveBeenLastCalledWith({ query: 'ami', status: 'WORKING', page: 1 });
  });

  it('pages through a long list', () => {
    useEmployees.mockReturnValue(query({ data: { items: [emp({})], page: 1, pageSize: 20, total: 45 } }) as never);
    render(<EmployeesScreen />);
    expect(screen.getByText('Page 1 of 3')).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(useEmployees).toHaveBeenLastCalledWith({ query: undefined, status: undefined, page: 2 });
  });

  it('shows loading and error states', () => {
    useEmployees.mockReturnValue(query({ isLoading: true }) as never);
    const { unmount } = render(<EmployeesScreen />);
    expect(screen.getByLabelText('Loading')).toBeOnTheScreen();
    unmount();
    useEmployees.mockReturnValue(query({ isError: true, error: new Error('x') }) as never);
    render(<EmployeesScreen />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });
});
