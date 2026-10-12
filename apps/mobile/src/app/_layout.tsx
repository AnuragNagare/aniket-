import '../tracking/background-task'; // Android runs this task headless; it must be defined at startup.
import { useEffect } from 'react';
import * as Sentry from '@sentry/react-native';
import { initMonitoring } from '../monitoring';

initMonitoring();
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import {
  Barlow_400Regular,
  Barlow_500Medium,
  Barlow_600SemiBold,
} from '@expo-google-fonts/barlow';
import { BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed';
import { warmUpApi } from '../api/warm-up';
import { useAuthStore } from '../auth/auth-store';
import { homeFor } from '../auth/home-for';

void SplashScreen.preventAutoHideAsync();
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

function RootLayout() {
  const [fontsLoaded] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowSemiCondensed_700Bold,
  });
  const status = useAuthStore((s) => s.status);
  const home = useAuthStore((s) => homeFor(s.user?.role));

  useEffect(() => {
    warmUpApi();
    void useAuthStore.getState().bootstrap();
    // Never show one person's data to the next person who signs in on this phone.
    return useAuthStore.subscribe((s, prev) => {
      if (prev.status === 'signedIn' && s.status === 'signedOut') queryClient.clear();
    });
  }, []);

  const ready = fontsLoaded && status !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FBF8F5' },
        }}
      >
        <Stack.Protected guard={status === 'signedIn' && home === 'employee'}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedIn' && home === 'admin'}>
          <Stack.Screen name="(admin)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'offline'}>
          <Stack.Screen name="offline" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
