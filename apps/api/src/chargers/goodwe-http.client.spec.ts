import { GoodWeHttpClient } from './goodwe-http.client';
import {
  ProviderAuthenticationError,
  ProviderAuthorizationError,
  ProviderFunctionalHttpError,
  ProviderPayloadInvalidError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUpstreamError,
} from './provider-errors';
import { validObjectFixture } from './__fixtures__/goodwe-sanitized.fixtures';

const request = {
  operation: 'test.read',
  url: new URL('https://example.invalid/read-only'),
  parse: (payload: unknown) => payload,
};

describe('GoodWeHttpClient', () => {
  const client = new GoodWeHttpClient();

  it('returns a valid JSON object from a successful 200 response', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(Response.json(validObjectFixture)) as jest.MockedFunction<typeof fetch>;
    await expect(client.get(request, { fetch: fetchMock })).resolves.toEqual(validObjectFixture);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, ProviderAuthenticationError],
    [403, ProviderAuthorizationError],
    [422, ProviderFunctionalHttpError],
  ])('does not retry HTTP %s', async (status, ErrorType) => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(new Response(null, { status }));

    await expect(client.get(request, { fetch: fetchMock })).rejects.toBeInstanceOf(ErrorType);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries 429 with limited backoff and then succeeds', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'retry-after': '0' } }))
      .mockResolvedValueOnce(Response.json({ ok: true }));
    const sleep = jest.fn(async () => undefined);

    await expect(client.get(request, { fetch: fetchMock, sleep })).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);
  });

  it('retries 5xx at most twice', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    const sleep = jest.fn(async () => undefined);

    await expect(client.get(request, { fetch: fetchMock, sleep })).rejects.toBeInstanceOf(
      ProviderUpstreamError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('classifies HTTP 500 as transient and applies bounded retry', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(new Response(null, { status: 500 })) as jest.MockedFunction<typeof fetch>;
    const sleep = jest.fn(async () => undefined);
    await expect(
      client.get({ ...request, maxRetries: 1 }, { fetch: fetchMock, sleep }),
    ).rejects.toBeInstanceOf(ProviderUpstreamError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-transient 5xx response', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(new Response(null, { status: 501 }));

    await expect(client.get(request, { fetch: fetchMock })).rejects.toMatchObject({
      code: 'PROVIDER_UPSTREAM_ERROR',
      retryable: false,
      httpStatus: 501,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry invalid payloads', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(new Response('not-json', { status: 200 }));

    await expect(client.get(request, { fetch: fetchMock })).rejects.toBeInstanceOf(
      ProviderPayloadInvalidError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enforces the request timeout', async () => {
    const fetchMock = jest.fn((_input: URL | RequestInfo, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }) as jest.MockedFunction<typeof fetch>;

    await expect(
      client.get({ ...request, timeoutMs: 100, maxRetries: 0 }, { fetch: fetchMock }),
    ).rejects.toBeInstanceOf(ProviderTimeoutError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry 429 when retry is disabled', async () => {
    const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
    fetchMock.mockResolvedValue(new Response(null, { status: 429 }));

    await expect(
      client.get({ ...request, maxRetries: 0 }, { fetch: fetchMock }),
    ).rejects.toBeInstanceOf(ProviderRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
