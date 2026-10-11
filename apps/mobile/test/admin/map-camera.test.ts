import { cameraFor, mapsUrl } from '../../src/admin/map-camera';

describe('cameraFor', () => {
  it('fits the trail with padding when there are several points', () => {
    const c = cameraFor([[72.82, 19.01], [72.9, 19.12]]);
    expect(c).toEqual({ bounds: [72.82, 19.01, 72.9, 19.12], padding: { top: 48, right: 48, bottom: 48, left: 48 } });
  });

  it('centres on a single point instead of zooming to infinity', () => {
    expect(cameraFor([[72.82, 19.01], [72.82, 19.01]])).toEqual({ center: [72.82, 19.01], zoom: 15 });
  });

  it('falls back to a wide view of India when there are no points', () => {
    expect(cameraFor(null)).toEqual({ center: [78.9629, 20.5937], zoom: 3.5 });
  });
});

describe('mapsUrl', () => {
  it('opens a coordinate in the phone maps app', () => {
    expect(mapsUrl(19.0176, 72.8562)).toBe('https://www.google.com/maps/search/?api=1&query=19.0176,72.8562');
  });
});
