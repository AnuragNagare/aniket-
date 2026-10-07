import * as SecureStore from 'expo-secure-store';

const KEY = 'wt.refresh';

/** The long-lived refresh token, kept in Android's encrypted storage. */
export const tokenStorage = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
