import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import PermissionsScreen from '../../src/app/(app)/permissions';
import * as location from '../../src/location/location';
import { useLocalSearchParams } from 'expo-router';

jest.mock('../../src/location/location');
const loc = location as jest.Mocked<typeof location>;

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('PermissionsScreen', () => {
  it('renders foreground disclosure when step=location', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ step: 'location' });
    loc.requestPermission.mockResolvedValue('denied');
    renderWithClient(<PermissionsScreen />);
    expect(screen.getByText('How Work Trail uses your location')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Allow location' })).toBeOnTheScreen();
  });

  it('renders background disclosure when step=background and handles blocked state', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ step: 'background' });
    loc.requestBackgroundPermission.mockResolvedValue('blocked');
    renderWithClient(<PermissionsScreen />);
    expect(
      screen.getByText('Keep recording while your screen is off'),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Open settings' })).toBeOnTheScreen();
  });
});
