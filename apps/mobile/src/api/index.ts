import { useAuthStore } from '../auth/auth-store';
import { API_URL } from '../config';
import { createApiClient } from './client';

export { ApiError } from './client';

/** The app's API client. Reads the in-memory access token; refreshes through the auth store. */
export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: () => useAuthStore.getState().refreshAccessToken(),
  onSessionExpired: () => void useAuthStore.getState().clearLocal(),
});
