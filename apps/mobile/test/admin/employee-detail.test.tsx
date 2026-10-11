import { fireEvent, render, screen } from '@testing-library/react-native';
import type { EmployeeDetail } from '@worktrail/types';
import { ApiError } from '../../src/api/client';
import * as hooks from '../../src/admin/hooks';
import EmployeeDetailScreen from '../../src/app/(admin)/employees/[id]';
import { mockRouter, useLocalSearchParams } from '../mocks/expo-router';

jest.mock('../../src/admin/hooks');
jest.mock('../../src/admin/use-company', () => ({
  useCompanyDay: () => ({ tz: 'Asia/Kolkata', today: '2026-10-07', companyName: 'Acme Services' }),
}));
jest.mock('../../src/components/admin/TrailMap', () => {
  const { Text } = require('react-native');
  return { TrailMap: ({ trail }: { trail: { points: unknown[] } }) => <Text>{`MAP ${trail.points.length} points`}</Text> };
});

const q = (over: object) => ({ data: undefined, isLoading: false, isError: false, error: null, refetch: jest.fn(), ...over });
const employee: EmployeeDetail = {
  id: 'e1', name: 'Amit Kumar', designation: 'Field Sales Executive', employeeCode: 'FS-12', email: 'amit@acme.in', status: 'WORKING',
  account: 'ACTIVE', phone: '+919876543210', joinedAt: '2026-09-01T00:00:00.000Z', workingSince: '2026-10-07T03:30:00.000Z',
  lastSeenAt: '2026-10-07T04:00:00.000Z', consentedAt: '2026-09-02T00:00:00.000Z', consentVersion: '1', deactivated: false,
};
const summary = { from: '2026-10-07', to: '2026-10-07', totalMinutes: 384, daysWorked: 1, updateCount: 3, pointCount: 40, distanceKm: 12.5, lastSeenAt: '2026-10-07T04:00:00.000Z', leftRunning: false };

beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({ id: 'e1' });
  jest.mocked(hooks.useEmployee).mockReturnValue(q({ data: employee }) as never);
  jest.mocked(hooks.useEmployeeSummary).mockReturnValue(q({ data: summary }) as never);
  jest.mocked(hooks.useEmployeeUpdates).mockReturnValue(q({ data: { items: [], page: 1, pageSize: 20, total: 0 } }) as never);
  jest.mocked(hooks.useEmployeeSessions).mockReturnValue(q({ data: { timezone: 'Asia/Kolkata', sessions: [], days: [], totalMinutes: 0 } }) as never);
  jest.mocked(hooks.useEmployeeTrail).mockReturnValue(q({ data: { timezone: 'Asia/Kolkata', sessions: [], points: [], gaps: [], truncated: false, stats: { pointCount: 0, lowAccuracyCount: 0, gapCount: 0, distanceKm: 0 } } }) as never);
  jest.mocked(hooks.useCloseSession).mockReturnValue({ mutateAsync: jest.fn(), isPending: false } as never);
});

describe('Employee detail', () => {
  it('shows who it is and the overview numbers for today', () => {
    render(<EmployeeDetailScreen />);
    expect(screen.getByText('Amit Kumar')).toBeOnTheScreen();
    expect(screen.getByText('Field Sales Executive')).toBeOnTheScreen();
    expect(screen.getByLabelText('Time worked: 6h 24m')).toBeOnTheScreen();
    expect(screen.getByLabelText('Distance: 12.5 km')).toBeOnTheScreen();
    expect(hooks.useEmployeeSummary).toHaveBeenCalledWith('e1', { from: '2026-10-07', to: '2026-10-07' });
  });

  it('changing the period reloads with that period (this week starts Monday)', () => {
    render(<EmployeeDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'This week' }));
    expect(hooks.useEmployeeSummary).toHaveBeenLastCalledWith('e1', { from: '2026-10-05', to: '2026-10-07' });
  });

  it('warns when a session was left running', () => {
    jest.mocked(hooks.useEmployeeSummary).mockReturnValue(q({ data: { ...summary, leftRunning: true } }) as never);
    render(<EmployeeDetailScreen />);
    expect(screen.getByText(/A work session is still open/)).toBeOnTheScreen();
  });

  it('Updates tab lists updates with AI summaries, or says there are none', () => {
    render(<EmployeeDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Updates' }));
    expect(screen.getByText('No updates in this period.')).toBeOnTheScreen();
    jest.mocked(hooks.useEmployeeUpdates).mockReturnValue(q({ data: { items: [{ id: 'u1', clientUpdateId: 'c', sessionId: 's', text: 'Installed sensors at the clinic.', inputMethod: 'TYPED', category: 'INSTALLATION', submittedAt: '2026-10-07T05:00:00.000Z', summaryStatus: 'COMPLETE', aiSummary: { summary: 'Installed sensors.', activities: [], issues: [], followUps: [], confidence: 'HIGH' } }], page: 1, pageSize: 20, total: 1 } }) as never);
    fireEvent.press(screen.getByRole('button', { name: 'Overview' }));
    fireEvent.press(screen.getByRole('button', { name: 'Updates' }));
    expect(screen.getByText('Installed sensors at the clinic.')).toBeOnTheScreen();
    expect(screen.getByText('Installed sensors.')).toBeOnTheScreen();
  });

  it('Hours tab shows days worked and the sessions', () => {
    jest.mocked(hooks.useEmployeeSessions).mockReturnValue(q({ data: { timezone: 'Asia/Kolkata', totalMinutes: 548, days: [{ date: '2026-10-07', minutes: 548 }], sessions: [{ id: 's1', status: 'COMPLETED', startedAt: '2026-10-07T03:32:00.000Z', endedAt: '2026-10-07T12:40:00.000Z', totalMinutes: 548, lastLocationAt: null, pointCount: 110, leftRunning: false }] } }) as never);
    render(<EmployeeDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Hours' }));
    expect(screen.getByText('Total 9h 8m')).toBeOnTheScreen();
    expect(screen.getByText('Completed')).toBeOnTheScreen();
  });

  it('Map tab hands the trail to the map', () => {
    jest.mocked(hooks.useEmployeeTrail).mockReturnValue(q({ data: { timezone: 'Asia/Kolkata', sessions: [], points: [{}, {}, {}], gaps: [], truncated: false, stats: { pointCount: 3, lowAccuracyCount: 1, gapCount: 0, distanceKm: 2.2 } } }) as never);
    render(<EmployeeDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByText('MAP 3 points')).toBeOnTheScreen();
    expect(screen.getByText('3 locations · 2.2 km · 1 approximate')).toBeOnTheScreen();
  });

  it('tells the admin when the trail was cut short', () => {
    jest.mocked(hooks.useEmployeeTrail).mockReturnValue(q({ data: { timezone: 'Asia/Kolkata', sessions: [], points: [{}], gaps: [], truncated: true, stats: { pointCount: 1, lowAccuracyCount: 0, gapCount: 0, distanceKm: 0 } } }) as never);
    render(<EmployeeDetailScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByText('Showing the first 5,000 locations.')).toBeOnTheScreen();
  });

  it('shows "not found" (no data) for an employee outside this company', () => {
    jest.mocked(hooks.useEmployee).mockReturnValue(q({ isError: true, error: new ApiError(404, 'NOT_FOUND', 'Employee not found.') }) as never);
    render(<EmployeeDetailScreen />);
    expect(screen.getByText('Employee not found.')).toBeOnTheScreen();
    expect(screen.queryByText('Amit Kumar')).toBeNull();
  });

  it('notes a deactivated account and an employee who has not joined', () => {
    jest.mocked(hooks.useEmployee).mockReturnValue(q({ data: { ...employee, deactivated: true } }) as never);
    const { unmount } = render(<EmployeeDetailScreen />);
    expect(screen.getByText('This account is deactivated.')).toBeOnTheScreen();
    unmount();
    jest.mocked(hooks.useEmployee).mockReturnValue(q({ data: { ...employee, account: 'INVITED' } }) as never);
    render(<EmployeeDetailScreen />);
    expect(screen.getByText('Invited, not joined yet')).toBeOnTheScreen();
  });

  it('goes back to the list', () => {
    render(<EmployeeDetailScreen />);
    fireEvent.press(screen.getByText('Back to employees'));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
