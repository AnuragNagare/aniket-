import * as SecureStore from 'expo-secure-store';

const KEY = 'lastCrashReport';
// SecureStore values should stay under about 2 KB.
const MAX = 1800;

/** Plain text a person can paste into a chat: what happened, where, and the app version. */
export function formatReport(error: unknown, source: string): string {
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error));
  const lines = [
    `Work Trail error report`,
    `When: ${new Date().toISOString()}`,
    `Where: ${source}`,
    `Error: ${e.name}: ${e.message}`,
    '',
    (e.stack ?? '').split('\n').slice(0, 14).join('\n'),
  ];
  return lines.join('\n').slice(0, MAX);
}

export async function saveCrash(report: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, report);
  } catch {
    // Saving the report must never cause a second crash.
  }
}

export async function loadCrash(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function clearCrash(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}

type GlobalErrorUtils = {
  getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
  setGlobalHandler: (h: (error: unknown, isFatal?: boolean) => void) => void;
};

/** Remembers uncaught JavaScript errors so the next launch can show them. */
export function installCrashRecorder() {
  const utils = (globalThis as { ErrorUtils?: GlobalErrorUtils }).ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    void saveCrash(formatReport(error, isFatal ? 'uncaught error (fatal)' : 'uncaught error'));
    previous(error, isFatal);
  });
}
