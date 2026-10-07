import appJson from '../app.json';

const expo = appJson.expo as {
  android: { permissions: string[] };
  plugins: Array<string | [string, Record<string, unknown>]>;
};
const plugin = (name: string) =>
  expo.plugins.find((p) => (Array.isArray(p) ? p[0] === name : p === name));

describe('app config for background tracking', () => {
  it('declares the Android permissions background tracking needs', () => {
    expect(expo.android.permissions).toEqual(
      expect.arrayContaining([
        'ACCESS_FINE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'POST_NOTIFICATIONS',
      ]),
    );
  });

  it('enables background location and the foreground service in expo-location', () => {
    expect(plugin('expo-location')).toEqual([
      'expo-location',
      expect.objectContaining({ isAndroidBackgroundLocationEnabled: true, isAndroidForegroundServiceEnabled: true }),
    ]);
  });

  it('includes sqlite and build properties', () => {
    expect(plugin('expo-sqlite')).toBeTruthy();
    expect(plugin('expo-build-properties')).toBeTruthy();
  });
});
