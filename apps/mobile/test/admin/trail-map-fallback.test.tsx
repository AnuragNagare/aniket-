import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import type { LocationTrailResponse } from '@worktrail/types';
import { TrailMap } from '../../src/components/admin/TrailMap';

// The native module is not installed in this environment (like Expo Go), so requiring it throws.
jest.mock('@maplibre/maplibre-react-native', () => {
  throw new Error('Cannot find native module');
});

const point = (i: number) => ({
  id: `p${i}`, sessionId: 's1', latitude: 19 + i / 100, longitude: 72.8, accuracyMeters: 10, speedMps: null,
  capturedAt: new Date(Date.UTC(2026, 9, 5, 4, i)).toISOString(), source: 'BACKGROUND' as const, qualityFlag: 'GOOD' as const,
});
const trail = (n: number): LocationTrailResponse => ({
  timezone: 'Asia/Kolkata', sessions: [], points: Array.from({ length: n }, (_, i) => point(i)), gaps: [], truncated: false,
  stats: { pointCount: n, lowAccuracyCount: 0, gapCount: 0, distanceKm: 0 },
});

describe('TrailMap without the native module', () => {
  it('lists the locations, each opening in the Maps app', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    render(<TrailMap trail={trail(3)} timezone="Asia/Kolkata" />);
    expect(screen.getByText(/The map could not be shown/)).toBeOnTheScreen();
    fireEvent.press(screen.getAllByText('Open in Maps')[0]!);
    expect(open).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=19,72.8');
  });

  it('caps a long list and says how many there are', () => {
    render(<TrailMap trail={trail(45)} timezone="Asia/Kolkata" />);
    expect(screen.getAllByText('Open in Maps')).toHaveLength(30);
    expect(screen.getByText('Showing the first 30 of 45 locations.')).toBeOnTheScreen();
  });
});
