import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { AdminSessionDto } from '@worktrail/types';
import { ApiError } from '../../src/api/client';
import * as hooks from '../../src/admin/hooks';
import { SessionCard } from '../../src/components/admin/SessionCard';

jest.mock('../../src/admin/hooks');

const close = { mutateAsync: jest.fn(), isPending: false };
const base: AdminSessionDto = {
  id: 's1', status: 'COMPLETED', startedAt: '2026-10-05T03:32:00.000Z', endedAt: '2026-10-05T12:40:00.000Z',
  totalMinutes: 548, lastLocationAt: '2026-10-05T12:35:00.000Z', pointCount: 110, leftRunning: false,
};
const active: AdminSessionDto = { ...base, id: 's2', status: 'ACTIVE', endedAt: null, totalMinutes: null, leftRunning: true };

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(new Date('2026-10-06T10:00:00.000Z'));
  jest.mocked(hooks.useCloseSession).mockReturnValue(close as never);
});
afterEach(() => jest.useRealTimers());

describe('SessionCard', () => {
  it('shows a finished session with times, duration, locations and its label', () => {
    render(<SessionCard session={base} timezone="Asia/Kolkata" employeeId="e1" />);
    expect(screen.getByText('Completed')).toBeOnTheScreen();
    expect(screen.getByText('Mon 5 Oct, 9:02 AM')).toBeOnTheScreen();
    expect(screen.getByText(/6:10 PM/)).toBeOnTheScreen();
    expect(screen.getByText('9h 8m')).toBeOnTheScreen();
    expect(screen.getByText('110 locations')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Close session' })).toBeNull();
  });

  it('labels a session left running and offers to close it', () => {
    render(<SessionCard session={active} timezone="Asia/Kolkata" employeeId="e1" employeeName="Vikram Rao" />);
    expect(screen.getByText('Left running')).toBeOnTheScreen();
    expect(screen.getByText('Vikram Rao')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Close session' })).toBeOnTheScreen();
  });

  it('closes at the last location time after the admin confirms the choice', async () => {
    close.mutateAsync.mockResolvedValue({});
    const onClosed = jest.fn();
    render(<SessionCard session={active} timezone="Asia/Kolkata" employeeId="e1" onClosed={onClosed} />);
    fireEvent.press(screen.getByRole('button', { name: 'Close session' }));
    fireEvent.press(screen.getByRole('button', { name: /Last location/ }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirm close' }));
    await waitFor(() => expect(close.mutateAsync).toHaveBeenCalled());
    expect(close.mutateAsync).toHaveBeenCalledWith({ employeeId: 'e1', sessionId: 's2', endedAt: '2026-10-05T12:35:00.000Z' });
    expect(onClosed).toHaveBeenCalled();
  });

  it('can close at the current time instead', async () => {
    close.mutateAsync.mockResolvedValue({});
    render(<SessionCard session={active} timezone="Asia/Kolkata" employeeId="e1" />);
    fireEvent.press(screen.getByRole('button', { name: 'Close session' }));
    fireEvent.press(screen.getByRole('button', { name: 'Now' }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirm close' }));
    await waitFor(() => expect(close.mutateAsync).toHaveBeenCalled());
    expect(close.mutateAsync.mock.calls[0]![0].endedAt).toBe('2026-10-06T10:00:00.000Z');
  });

  it('shows the server message when the session has already ended', async () => {
    close.mutateAsync.mockRejectedValue(new ApiError(409, 'SESSION_NOT_ACTIVE', 'This work session has already ended.'));
    render(<SessionCard session={active} timezone="Asia/Kolkata" employeeId="e1" />);
    fireEvent.press(screen.getByRole('button', { name: 'Close session' }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirm close' }));
    expect(await screen.findByText('This work session has already ended.')).toBeOnTheScreen();
  });

  it('can be cancelled without calling the server', () => {
    render(<SessionCard session={active} timezone="Asia/Kolkata" employeeId="e1" />);
    fireEvent.press(screen.getByRole('button', { name: 'Close session' }));
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(close.mutateAsync).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Confirm close' })).toBeNull();
  });
});
