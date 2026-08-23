import type { ProviderCapability } from './charger-provider';

export class ChargerProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
    readonly httpStatus?: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ProviderCapabilityNotSupportedError extends ChargerProviderError {
  constructor(
    readonly capability: ProviderCapability,
    provider: string,
    reason: string,
  ) {
    super(
      `O provider ${provider} não suporta a capacidade ${capability}: ${reason}`,
      'PROVIDER_CAPABILITY_NOT_SUPPORTED',
      false,
    );
  }
}

export class ProviderResourceNotFoundError extends ChargerProviderError {
  constructor(resource: string) {
    super(`${resource} não encontrado no provider.`, 'PROVIDER_RESOURCE_NOT_FOUND', false, 404);
  }
}

export class ProviderAuthenticationError extends ChargerProviderError {
  constructor() {
    super('A autenticação do provider foi rejeitada.', 'PROVIDER_UNAUTHORIZED', false, 401);
  }
}

export class ProviderAuthorizationError extends ChargerProviderError {
  constructor() {
    super('O acesso ao recurso do provider foi negado.', 'PROVIDER_FORBIDDEN', false, 403);
  }
}

export class ProviderRateLimitError extends ChargerProviderError {
  constructor(readonly retryAfterMs?: number) {
    super('O limite de requisições do provider foi atingido.', 'PROVIDER_RATE_LIMITED', true, 429);
  }
}

export class ProviderFunctionalHttpError extends ChargerProviderError {
  constructor(status: number) {
    super('O provider rejeitou a requisição.', 'PROVIDER_FUNCTIONAL_HTTP_ERROR', false, status);
  }
}

export class ProviderUpstreamError extends ChargerProviderError {
  constructor(status?: number, retryable = true) {
    super('O provider retornou uma falha interna.', 'PROVIDER_UPSTREAM_ERROR', retryable, status);
  }
}

export class ProviderTimeoutError extends ChargerProviderError {
  constructor() {
    super('A consulta ao provider excedeu o tempo limite.', 'PROVIDER_TIMEOUT', true);
  }
}

export class ProviderPayloadInvalidError extends ChargerProviderError {
  constructor() {
    super('O provider retornou um payload inválido.', 'PROVIDER_PAYLOAD_INVALID', false);
  }
}
