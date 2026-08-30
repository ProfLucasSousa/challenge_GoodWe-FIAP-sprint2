import { GoodWeApiClient } from './goodwe-api.client';
import type { GoodWeAuthClient } from './goodwe-auth.client';
import type { GoodWeHttpClient } from './goodwe-http.client';

describe('GoodWeApiClient', () => {
  it('clears short-lived authorization headers after a confirmed read', async () => {
    const headers = { authorization: 'fixture-token-never-log', 'x-api-key': 'fixture-key' };
    const auth = {
      createAuthorizationHeaders: jest.fn(() => headers),
    } as unknown as GoodWeAuthClient;
    const http = {
      get: jest.fn().mockResolvedValue({ accepted: true }),
    } as unknown as GoodWeHttpClient;
    const client = new GoodWeApiClient(auth, http);

    await expect(
      client.executeConfirmedRead({
        operation: 'fixture.read',
        url: new URL('https://example.invalid/read-only'),
        parse: (payload) => payload,
      }),
    ).resolves.toEqual({ accepted: true });
    expect(headers).toEqual({});
    expect(JSON.stringify((http.get as jest.Mock).mock.results)).not.toContain(
      'fixture-token-never-log',
    );
  });
});
