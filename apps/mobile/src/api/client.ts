import type { ApiErrorBody } from '@worktrail/types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST';
type Deps = {
  baseUrl: string;
  fetchFn?: typeof fetch;
  getAccessToken: () => string | null;
  /** Returns a fresh access token, or null when the session can't be renewed. */
  refreshAccessToken: () => Promise<string | null>;
  onSessionExpired: () => void;
  onAccountDisabled?: () => void;
};

export type ApiClient = {
  request<T>(
    method: Method,
    path: string,
    body?: unknown,
    opts?: { auth?: boolean; headers?: Record<string, string> },
  ): Promise<T>;
};

const OFFLINE = 'You appear to be offline. Check your connection and try again.';

export function createApiClient(deps: Deps): ApiClient {
  const fetchFn = deps.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  let refreshing: Promise<string | null> | null = null;

  // Refresh tokens rotate and reuse is treated as theft, so concurrent 401s must share one refresh.
  const refreshOnce = () => {
    refreshing ??= deps.refreshAccessToken().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  async function send(
    method: Method,
    path: string,
    body: unknown,
    token: string | null,
    extraHeaders?: Record<string, string>,
  ) {
    try {
      return await fetchFn(`${deps.baseUrl}/api/v1${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...extraHeaders,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'NETWORK', OFFLINE);
    }
  }

  async function parse<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T;
    const json: unknown = await res.json().catch(() => null);
    if (res.ok) return json as T;
    const e = (json as ApiErrorBody | null)?.error;
    if (e?.code === 'ACCOUNT_DISABLED') {
      deps.onAccountDisabled?.();
    }
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? 'Something went wrong. Try again.',
      e?.details ?? {},
    );
  }

  return {
    async request<T>(
      method: Method,
      path: string,
      body?: unknown,
      opts: { auth?: boolean; headers?: Record<string, string> } = {},
    ) {
      const auth = opts.auth ?? true;
      let res = await send(method, path, body, auth ? deps.getAccessToken() : null, opts.headers);
      if (auth && res.status === 401) {
        const clone = res.clone();
        const json: any = await clone.json().catch(() => null);
        if (json?.error?.code === 'ACCOUNT_DISABLED') {
          deps.onAccountDisabled?.();
          throw new ApiError(401, 'ACCOUNT_DISABLED', 'This account has been turned off by your company.');
        }
        const token = await refreshOnce();
        if (!token) {
          deps.onSessionExpired();
          throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.');
        }
        res = await send(method, path, body, token, opts.headers);
        if (res.status === 401) {
          const clone2 = res.clone();
          const json2: any = await clone2.json().catch(() => null);
          if (json2?.error?.code === 'ACCOUNT_DISABLED') {
            deps.onAccountDisabled?.();
          } else {
            deps.onSessionExpired();
          }
        }
      }
      return parse<T>(res);
    },
  };
}
