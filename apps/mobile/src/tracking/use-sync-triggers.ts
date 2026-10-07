import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncNow } from './uploader';

/** Upload queued points when the app comes back and when the connection returns. */
export function useSyncTriggers() {
  useEffect(() => {
    void syncNow().catch(() => undefined);
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') void syncNow().catch(() => undefined);
    });
    const net = NetInfo.addEventListener((s) => {
      if (s.isConnected) void syncNow().catch(() => undefined);
    });
    return () => {
      app.remove();
      net();
    };
  }, []);
}
