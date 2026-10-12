import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuthStore } from './auth-store';

/** Asks first, then signs out. The root layout then returns to the welcome screen. */
export function useConfirmSignOut() {
  const signOut = useAuthStore((s) => s.signOut);
  const [busy, setBusy] = useState(false);

  const confirm = () =>
    Alert.alert('Sign out?', 'You will need your email and password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        },
      },
    ]);

  return { confirm, busy };
}
