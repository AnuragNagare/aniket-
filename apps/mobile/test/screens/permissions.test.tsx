import { fireEvent, render, screen } from '@testing-library/react-native';
import PermissionsScreen from '../../src/app/(app)/permissions';
import * as location from '../../src/location/location';
import { useLocalSearchParams } from 'expo-router';

jest.mock('../../src/location/location');
const loc = location as jest.Mocked<typeof location>;

describe('PermissionsScreen', () => {
  it('renders foreground disclosure by default', async () => {
    loc.requestPermission.mockResolvedValue('denied');
    render(<PermissionsScreen />);
    expect(screen.getByText('How Work Trail uses your location')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Allow location' })).toBeOnTheScreen();
  });

  it('renders background disclosure when step=background and handles blocked state', async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({ step: 'background' });
    loc.requestBackgroundPermission.mockResolvedValue('blocked');
    render(<PermissionsScreen />);
    expect(
      screen.getByText('Keep recording while your screen is off'),
    ).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('button', { name: 'Open settings' })).toBeOnTheScreen();
  });
});
