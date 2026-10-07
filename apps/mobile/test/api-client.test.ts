import { ApiError, createApiClient } from '../src/api/client';

const ok = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
const err = (status: number, code: string, message: string) =>
  Promise.resolve(
    new Response(JSON.stringify({ error: { code, message, details: {} } }), { status }),
  );

function setup(overrides: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  let token: string | null = 'old';
  const fetchFn = jest.fn();
  const refreshAccessToken = jest.fn(async () => {
    await new Promise((r) => setTimeout(r, 10));
    token = 'new';
    return token;
  });
  const onSessionExpired = jest.fn();
  const client = createApiClient({
    baseUrl: 'http://api.test',
    fetchFn,
    getAccessToken: () => token,
    refreshAccessToken,
    onSessionExpired,
    ...overrides,
  });
  return { client, fetchFn, refreshAccessToken, onSessionExpired };
}

describe('api client', () => {
  it('sends the bearer token and parses JSON', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockReturnValueOnce(ok({ hi: 1 }));
    await expect(client.request('GET', '/me')).resolves.toEqual({ hi: 1 });
    expect(fetchFn).toHaveBeenCalledWith(
      'http://api.test/api/v1/me',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer old' }),
      }),
    );
  });

  it('refreshes once for many simultaneous 401s and retries each request', async () => {
    const { client, fetchFn, refreshAccessToken } = setup();
    fetchFn.mockImplementation((_url: string, init: RequestInit) =>
      (init.headers as Record<string, string>).authorization === 'Bearer new'
        ? ok({ ok: true })
        : err(401, 'TOKEN_EXPIRED', 'x'),
    );
    const results = await Promise.all([
      client.request('GET', '/a'),
      client.request('GET', '/b'),
      client.request('GET', '/c'),
    ]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it('signs out when refresh is refused', async () => {
    const { client, fetchFn, onSessionExpired } = setup({
      refreshAccessToken: jest.fn(async () => null),
    });
    fetchFn.mockReturnValue(err(401, 'TOKEN_EXPIRED', 'x'));
    await expect(client.request('GET', '/me')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(onSessionExpired).toHaveBeenCalled();
  });

  it('turns API error envelopes into ApiError with the server message', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockReturnValue(
      err(409, 'SESSION_ALREADY_ACTIVE', 'You already have a work session running.'),
    );
    const e = await client.request('POST', '/sessions/start', {}).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({
      status: 409,
      code: 'SESSION_ALREADY_ACTIVE',
      message: 'You already have a work session running.',
    });
  });

  it('reports being offline in plain words', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockRejectedValue(new TypeError('Network request failed'));
    await expect(client.request('GET', '/me')).rejects.toMatchObject({
      code: 'NETWORK',
      message: 'You appear to be offline. Check your connection and try again.',
    });
  });

  it('does not send a token or refresh for public calls', async () => {
    const { client, fetchFn, refreshAccessToken } = setup();
    fetchFn.mockReturnValue(err(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'));
    await expect(
      client.request('POST', '/auth/login', {}, { auth: false }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(refreshAccessToken).not.toHaveBeenCalled();
    expect((fetchFn.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('authorization');
  });

  it('passes extra headers such as Idempotency-Key', async () => {
    const { client, fetchFn } = setup();
    fetchFn.mockReturnValueOnce(ok({}));
    await client.request('POST', '/locations/batch', {}, { headers: { 'idempotency-key': 'k1' } });
    expect((fetchFn.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'idempotency-key': 'k1' });
  });
});
