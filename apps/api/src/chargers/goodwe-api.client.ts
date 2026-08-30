import { Injectable } from '@nestjs/common';
import type { ProviderCapability } from './charger-provider';
import { GoodWeAuthClient } from './goodwe-auth.client';
import { GoodWeHttpClient, type GoodWeReadRequest } from './goodwe-http.client';
import { ProviderCapabilityNotSupportedError } from './provider-errors';

@Injectable()
export class GoodWeApiClient {
  constructor(
    private readonly auth: GoodWeAuthClient,
    private readonly http: GoodWeHttpClient,
  ) {}

  /** Reserved for a future request backed by an official, reviewed contract. */
  async executeConfirmedRead<T>(request: Omit<GoodWeReadRequest<T>, 'headers'>): Promise<T> {
    const headers = this.auth.createAuthorizationHeaders();
    try {
      return await this.http.get({ ...request, headers });
    } finally {
      for (const key of Object.keys(headers)) delete headers[key];
    }
  }

  unsupported(capability: ProviderCapability): never {
    throw new ProviderCapabilityNotSupportedError(
      capability,
      'goodwe',
      'a descoberta não confirmou endpoint, autenticação ou payload oficial para o HCA G2',
    );
  }
}
