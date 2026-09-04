import { Test, type TestingModule } from '@nestjs/testing';
import { GoodWeApiClient } from './goodwe-api.client';
import { GoodWeAuthClient } from './goodwe-auth.client';
import { GoodWeHttpClient } from './goodwe-http.client';
import { GoodWeSemsProvider } from './goodwe-sems.provider';
import { ProviderCapabilityNotSupportedError } from './provider-errors';

describe('GoodWeSemsProvider', () => {
  let moduleRef: TestingModule;
  let provider: GoodWeSemsProvider;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [GoodWeAuthClient, GoodWeHttpClient, GoodWeApiClient, GoodWeSemsProvider],
    }).compile();
    provider = moduleRef.get(GoodWeSemsProvider);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('starts without authenticating or making an HTTP call', async () => {
    await expect(provider.healthCheck()).resolves.toMatchObject({
      provider: 'goodwe',
      status: 'unavailable',
      capabilities: {
        listChargers: false,
        chargerStatus: false,
        telemetry: false,
        sessions: false,
      },
    });
  });

  it.each([
    ['listChargers', () => provider.listChargers()],
    ['chargerStatus', () => provider.getChargerStatus('redacted')],
    ['telemetry', () => provider.getTelemetry('redacted')],
    [
      'sessions',
      () =>
        provider.getSessions('redacted', {
          from: new Date('2026-01-01T00:00:00.000Z'),
          to: new Date('2026-01-02T00:00:00.000Z'),
        }),
    ],
  ])('exposes %s as an explicit unsupported capability', async (_capability, call) => {
    await expect(call()).rejects.toBeInstanceOf(ProviderCapabilityNotSupportedError);
  });

  it('does not treat SEMS+ credentials as OpenAPI credentials', () => {
    expect(() => new GoodWeAuthClient().createAuthorizationHeaders()).toThrow(
      ProviderCapabilityNotSupportedError,
    );
  });
});
