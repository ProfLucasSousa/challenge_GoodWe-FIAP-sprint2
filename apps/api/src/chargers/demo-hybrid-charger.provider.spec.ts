import type { ProviderHealth } from './charger-provider';
import { DemoHybridChargerProvider } from './demo-hybrid-charger.provider';
import type { GoodWeSemsProvider } from './goodwe-sems.provider';
import { MockChargerProvider } from './mock-charger.provider';

const capabilities = (enabled: boolean): ProviderHealth['capabilities'] => ({
  listChargers: enabled,
  chargerStatus: enabled,
  telemetry: enabled,
  sessions: enabled,
  events: enabled,
  rfid: false,
  alarms: enabled,
  startSession: false,
  remoteControl: false,
});

describe('DemoHybridChargerProvider', () => {
  it('remains usable offline with every returned record marked MOCK', async () => {
    const goodwe = {
      healthCheck: jest.fn().mockRejectedValue(new Error('offline')),
    } as unknown as GoodWeSemsProvider;
    const provider = new DemoHybridChargerProvider(goodwe, new MockChargerProvider());

    const chargers = await provider.listChargers();
    expect(chargers).toHaveLength(3);
    expect(chargers.every((charger) => charger.origin === 'MOCK')).toBe(true);
    await expect(provider.getTelemetry(chargers[0]!.externalId)).resolves.toMatchObject({
      origin: 'MOCK',
    });
    await expect(provider.healthCheck()).resolves.toMatchObject({
      provider: 'demo',
      status: 'degraded',
    });
  });

  it('uses only REAL devices when every GoodWe read capability is available', async () => {
    const realCharger = {
      origin: 'REAL' as const,
      externalId: 'sanitized-real-fixture',
      serialNumber: 'SANITIZED-FIXTURE',
      name: 'HCA G2 Sanitizado',
      model: 'GW11K-HCA-20' as const,
      nominalPowerKw: 11,
      phaseType: 'THREE_PHASE' as const,
      location: 'Local autorizado',
    };
    const goodwe = {
      healthCheck: jest.fn().mockResolvedValue({
        provider: 'goodwe',
        status: 'available',
        checkedAt: new Date(),
        message: 'ok',
        capabilities: capabilities(true),
      }),
      listChargers: jest.fn().mockResolvedValue([realCharger]),
      getTelemetry: jest.fn().mockResolvedValue({
        origin: 'REAL',
        externalId: realCharger.externalId,
        status: 'AVAILABLE',
        powerKw: null,
        currentA: null,
        voltageV: null,
        accumulatedEnergyKwh: null,
        observedAt: new Date(),
      }),
    } as unknown as GoodWeSemsProvider;
    const provider = new DemoHybridChargerProvider(goodwe, new MockChargerProvider());

    await expect(provider.listChargers()).resolves.toEqual([realCharger]);
    await expect(provider.getTelemetry(realCharger.externalId)).resolves.toMatchObject({
      origin: 'REAL',
    });
  });

  it('supplements missing real capabilities with separate MOCK devices', async () => {
    const realCharger = {
      origin: 'REAL' as const,
      externalId: 'sanitized-real-partial',
      serialNumber: 'SANITIZED-PARTIAL',
      name: 'HCA G2 Real',
      model: 'GW7K-HCA-20' as const,
      nominalPowerKw: 7,
      phaseType: 'SINGLE_PHASE' as const,
      location: 'Local autorizado',
    };
    const goodwe = {
      healthCheck: jest.fn().mockResolvedValue({
        provider: 'goodwe',
        status: 'degraded',
        checkedAt: new Date(),
        message: 'partial',
        capabilities: { ...capabilities(false), listChargers: true },
      }),
      listChargers: jest.fn().mockResolvedValue([realCharger]),
    } as unknown as GoodWeSemsProvider;
    const provider = new DemoHybridChargerProvider(goodwe, new MockChargerProvider());

    const result = await provider.listChargers();
    expect(result.filter((item) => item.origin === 'REAL')).toHaveLength(1);
    expect(result.filter((item) => item.origin === 'MOCK')).toHaveLength(3);
    expect(new Set(result.map((item) => item.origin))).toEqual(new Set(['REAL', 'MOCK']));
  });
});
