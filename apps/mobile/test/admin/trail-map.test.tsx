import { render, screen } from '@testing-library/react-native';
import type { LocationTrailResponse, TrailPoint } from '@worktrail/types';
import { Text, View } from 'react-native';
import { TrailMap } from '../../src/components/admin/TrailMap';

// A stand-in for the native module, so the component logic can be tested without a device.
jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native');
  const pass = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>;
  return { Map: pass, Camera: () => null, GeoJSONSource: pass, Layer: () => null, Marker: pass };
});

const pt = (id: string, min: number, lat: number, quality: TrailPoint['qualityFlag'] = 'GOOD'): TrailPoint => ({
  id, sessionId: 's1', latitude: lat, longitude: 72.8, accuracyMeters: 10, speedMps: null,
  capturedAt: new Date(Date.UTC(2026, 9, 5, 4, min)).toISOString(), source: 'BACKGROUND', qualityFlag: quality,
});
const trail = (points: TrailPoint[]): LocationTrailResponse => ({
  timezone: 'Asia/Kolkata',
  sessions: [{ id: 's1', status: 'COMPLETED', startedAt: '2026-10-05T04:00:00.000Z', endedAt: '2026-10-05T05:00:00.000Z' }],
  points, gaps: [], truncated: false,
  stats: { pointCount: points.length, lowAccuracyCount: 0, gapCount: 0, distanceKm: 1 },
});

describe('TrailMap', () => {
  it('draws the map with a legend when there are points', () => {
    render(<TrailMap trail={trail([pt('a', 0, 19.0), pt('b', 5, 19.01), pt('c', 10, 19.02, 'LOW_ACCURACY')])} timezone="Asia/Kolkata" />);
    expect(screen.getByLabelText('Map of the recorded route')).toBeOnTheScreen();
    expect(screen.getByText(/Hollow dot: approximate location/)).toBeOnTheScreen();
    expect(screen.getByText('S')).toBeOnTheScreen();
    expect(screen.getByText('E')).toBeOnTheScreen();
  });

  it('says so plainly when nothing was recorded', () => {
    render(<TrailMap trail={trail([])} timezone="Asia/Kolkata" />);
    expect(screen.getByText('No locations were recorded in this period.')).toBeOnTheScreen();
  });
});

describe('TrailMap when the map crashes while drawing', () => {
  const Boom = () => {
    throw new Error('native map failed');
  };
  it('shows the list of locations instead of crashing', () => {
    jest.resetModules();
    jest.doMock('@maplibre/maplibre-react-native', () => ({ Map: Boom, Camera: () => null, GeoJSONSource: () => null, Layer: () => null, Marker: () => null }));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TrailMap: Fresh } = require('../../src/components/admin/TrailMap');
    render(<Fresh trail={trail([pt('a', 0, 19.0), pt('b', 5, 19.01)])} timezone="Asia/Kolkata" />);
    expect(screen.getByText(/The map could not be shown/)).toBeOnTheScreen();
    expect(screen.getAllByText('Open in Maps')).toHaveLength(2);
    spy.mockRestore();
    jest.dontMock('@maplibre/maplibre-react-native');
    void Text;
    void View;
  });
});
