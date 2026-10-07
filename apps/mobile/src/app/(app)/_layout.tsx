import { Stack } from 'expo-router';
import { useSyncTriggers } from '../../tracking/use-sync-triggers';

export default function AppLayout() {
  useSyncTriggers();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="permissions" options={{ presentation: 'modal' }} />
      <Stack.Screen name="profile" />
      <Stack.Screen name="update" options={{ presentation: 'modal' }} />
      <Stack.Screen name="history" />
    </Stack>
  );
}
