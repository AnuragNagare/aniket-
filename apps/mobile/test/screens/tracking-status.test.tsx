import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrackingStatus } from '../../src/components/TrackingStatus';
import * as tracking from '../../src/tracking/tracking';

jest.mock('../../src/tracking/tracking');
const status = tracking.getTrackingStatus as jest.Mock;

const renderIt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TrackingStatus timezone="Asia/Kolkata" />
    </QueryClientProvider>,
  );

describe('TrackingStatus', () => {
  it('says how often location is shared and when it last went', async () => {
    status.mockResolvedValue({
      mode: 'background',
      pending: 0,
      lastSentAt: '2026-10-06T04:54:00.000Z',
      pendingEnd: false,
    });
    renderIt();
    expect(
      await screen.findByText('Location shared every 5 minutes · last sent 10:24 AM'),
    ).toBeOnTheScreen();
  });

  it('shows what is waiting while offline', async () => {
    status.mockResolvedValue({
      mode: 'background',
      pending: 3,
      lastSentAt: null,
      pendingEnd: false,
    });
    renderIt();
    expect(
      await screen.findByText('3 locations waiting to send. They’ll go when you’re back online.'),
    ).toBeOnTheScreen();
  });

  it('is honest when background location is off, and offers the fix', async () => {
    status.mockResolvedValue({
      mode: 'startEndOnly',
      pending: 0,
      lastSentAt: null,
      pendingEnd: false,
    });
    renderIt();
    expect(
      await screen.findByText(
        'Background location is off, so only your start and end locations are recorded.',
        { exact: false },
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Turn it on' })).toBeOnTheScreen();
  });

  it('shows nothing when off duty', async () => {
    status.mockResolvedValue({
      mode: 'off',
      pending: 0,
      lastSentAt: null,
      pendingEnd: false,
    });
    renderIt();
    expect(screen.queryByText(/Location shared/)).toBeNull();
  });
});
