import type { ChargerProvider } from './charger-provider';
import { GoodWeApiClient } from './goodwe-api.client';
import { GoodWeAuthClient } from './goodwe-auth.client';
import { GoodWeHttpClient } from './goodwe-http.client';
import { GoodWeSemsProvider } from './goodwe-sems.provider';
import { MockChargerProvider } from './mock-charger.provider';
import { ProviderCapabilityNotSupportedError } from './provider-errors';

function providerContract(name: string, create: () => ChargerProvider) {
  describe(`${name} ChargerProvider contract`, () => {
    let provider: ChargerProvider;
    beforeEach(() => {
      provider = create();
    });

    it('has a stable name and a complete health capability map', async () => {
      const health = await provider.healthCheck();
      expect(health.provider).toBe(provider.name);
      expect(health.checkedAt).toBeInstanceOf(Date);
      expect(Object.keys(health.capabilities).sort()).toEqual(
        [
          'alarms',
          'chargerStatus',
          'events',
          'listChargers',
          'remoteControl',
          'rfid',
          'sessions',
          'startSession',
          'telemetry',
        ].sort(),
      );
    });

    it('keeps advertised list/telemetry capabilities consistent with behavior', async () => {
      const health = await provider.healthCheck();
      if (!health.capabilities.listChargers) {
        await expect(provider.listChargers()).rejects.toBeInstanceOf(
          ProviderCapabilityNotSupportedError,
        );
        return;
      }
      const chargers = await provider.listChargers();
      expect(chargers.length).toBeGreaterThan(0);
      const telemetry = await provider.getTelemetry(chargers[0]!.externalId);
      expect(telemetry.externalId).toBe(chargers[0]!.externalId);
      expect(telemetry.observedAt).toBeInstanceOf(Date);
    });
  });
}

providerContract('Mock', () => new MockChargerProvider());
providerContract(
  'GoodWe',
  () => new GoodWeSemsProvider(new GoodWeApiClient(new GoodWeAuthClient(), new GoodWeHttpClient())),
);
