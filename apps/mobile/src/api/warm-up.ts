import { API_URL } from '../config';

/**
 * Free hosting puts the API to sleep when idle, and the first request can take about a minute.
 * Pinging it as the app opens lets it wake while the person reads the welcome screen.
 */
export function warmUpApi() {
  void fetch(`${API_URL}/api/v1/health`).catch(() => undefined);
}
