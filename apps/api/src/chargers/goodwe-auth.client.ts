import { Injectable } from '@nestjs/common';
import { ProviderCapabilityNotSupportedError } from './provider-errors';

@Injectable()
export class GoodWeAuthClient {
  /**
   * The official public documentation does not define an OpenAPI authentication
   * contract. Deliberately does not read SEMS+ username/password: portal credentials
   * must never be assumed to be API credentials.
   */
  createAuthorizationHeaders(): Record<string, string> {
    throw new ProviderCapabilityNotSupportedError(
      'authentication',
      'goodwe',
      'o mecanismo oficial de autenticação OpenAPI não foi disponibilizado',
    );
  }
}
