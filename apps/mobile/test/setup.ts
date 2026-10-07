// In-memory SecureStore so auth code runs under Jest.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    deleteItemAsync: jest.fn(async (k: string) => void store.delete(k)),
    __reset: () => store.clear(),
  };
});

// Screens navigate with expo-router; tests import mockRouter from test/mocks/expo-router.
jest.mock('expo-router', () => require('./mocks/expo-router'));

process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn(), isTaskRegisteredAsync: jest.fn(async () => false) }));
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('expo-intent-launcher', () => ({ startActivityAsync: jest.fn(), ActivityAction: { IGNORE_BATTERY_OPTIMIZATION_SETTINGS: 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS' } }));
jest.mock('expo-speech-recognition', () => require('./mocks/speech'));

jest.setTimeout(20_000);
