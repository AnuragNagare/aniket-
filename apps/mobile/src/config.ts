/** API base URL, set per developer in apps/mobile/.env. Emulator default reaches the host machine. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';

/** Website pages the app links out to (password reset lives on the web). */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? API_URL.replace(':4000', ':3000');
