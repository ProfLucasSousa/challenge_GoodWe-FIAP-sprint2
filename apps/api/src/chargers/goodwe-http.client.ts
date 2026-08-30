import { Injectable, Logger } from '@nestjs/common';
import {
  ChargerProviderError,
  ProviderAuthenticationError,
  ProviderAuthorizationError,
  ProviderFunctionalHttpError,
  ProviderPayloadInvalidError,
  ProviderRateLimitError,
  ProviderTimeoutError,
  ProviderUpstreamError,
} from './provider-errors';

export interface GoodWeReadRequest<T> {
  operation: string;
  url: URL;
  headers?: HeadersInit;
  timeoutMs?: number;
  maxRetries?: number;
  parse(payload: unknown): T;
}

interface TransportHooks {
  fetch?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
}

@Injectable()
export class GoodWeHttpClient {
  private readonly logger = new Logger(GoodWeHttpClient.name);

  async get<T>(request: GoodWeReadRequest<T>, hooks: TransportHooks = {}): Promise<T> {
    const fetchImpl = hooks.fetch ?? fetch;
    const sleep =
      hooks.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
    const maxRetries = Math.min(Math.max(request.maxRetries ?? 2, 0), 2);
    const operation = request.operation.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 80);

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.executeOnce(request, fetchImpl);
      } catch (error) {
        const providerError = this.normalizeError(error);
        if (!providerError.retryable || attempt >= maxRetries) {
          throw providerError;
        }

        const delayMs = this.retryDelay(providerError, attempt);
        this.logger.warn(
          `provider_http_retry operation=${operation} code=${providerError.code} attempt=${attempt + 1}`,
        );
        await sleep(delayMs);
      }
    }
  }

  private async executeOnce<T>(request: GoodWeReadRequest<T>, fetchImpl: typeof fetch): Promise<T> {
    if (request.url.protocol !== 'https:') {
      throw new ProviderFunctionalHttpError(400);
    }

    const timeoutMs = Math.min(Math.max(request.timeoutMs ?? 5_000, 100), 30_000);
    const controller = new AbortController();
    const headers = new Headers(request.headers);
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new ProviderTimeoutError());
        }, timeoutMs);
      });
      const response = await Promise.race([
        fetchImpl(request.url, {
          method: 'GET',
          headers,
          signal: controller.signal,
          redirect: 'error',
        }),
        timeoutPromise,
      ]);

      this.assertResponseStatus(response);

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new ProviderPayloadInvalidError();
      }

      try {
        return request.parse(payload);
      } catch (error) {
        if (error instanceof ChargerProviderError) throw error;
        throw new ProviderPayloadInvalidError();
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      headers.delete('authorization');
      headers.delete('cookie');
      headers.delete('x-api-key');
    }
  }

  private assertResponseStatus(response: Response) {
    if (response.ok) return;
    if (response.status === 401) throw new ProviderAuthenticationError();
    if (response.status === 403) throw new ProviderAuthorizationError();
    if (response.status === 429) {
      throw new ProviderRateLimitError(this.parseRetryAfter(response.headers.get('retry-after')));
    }
    if (response.status >= 500) {
      const transient = [500, 502, 503, 504].includes(response.status);
      throw new ProviderUpstreamError(response.status, transient);
    }
    throw new ProviderFunctionalHttpError(response.status);
  }

  private normalizeError(error: unknown) {
    if (error instanceof ChargerProviderError) return error;
    if (error instanceof Error && error.name === 'AbortError') return new ProviderTimeoutError();
    return new ProviderUpstreamError();
  }

  private retryDelay(error: ChargerProviderError, attempt: number) {
    if (error instanceof ProviderRateLimitError && error.retryAfterMs !== undefined) {
      return Math.min(error.retryAfterMs, 1_000);
    }
    return Math.min(100 * 2 ** attempt, 1_000);
  }

  private parseRetryAfter(value: string | null) {
    if (!value) return undefined;
    const seconds = Number(value);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
  }
}
