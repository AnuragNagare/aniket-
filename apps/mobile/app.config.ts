import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const isDev = !profile || profile === 'development';
  const cleartext = isDev;

  const plugins = (config.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === 'expo-build-properties') {
      return [
        'expo-build-properties',
        {
          ...(plugin[1] as Record<string, any>),
          android: {
            ...((plugin[1] as any)?.android || {}),
            usesCleartextTraffic: cleartext,
          },
        },
      ] as [string, any];
    }
    return plugin;
  }) as NonNullable<ExpoConfig['plugins']>;

  if (process.env.EXPO_PUBLIC_SENTRY_DSN || profile === 'preview' || profile === 'production') {
    const hasSentry = plugins.some(
      (p) =>
        (typeof p === 'string' && p === '@sentry/react-native/expo') ||
        (Array.isArray(p) && p[0] === '@sentry/react-native/expo'),
    );
    if (!hasSentry) {
      plugins.push([
        '@sentry/react-native/expo',
        {
          url: 'https://sentry.io/',
          project: process.env.SENTRY_PROJECT || 'worktrail-mobile',
          organization: process.env.SENTRY_ORG || 'worktrail',
        },
      ]);
    }
  }

  return {
    ...config,
    name: config.name ?? 'Work Trail',
    slug: config.slug ?? 'work-trail',
    plugins,
  };
};
