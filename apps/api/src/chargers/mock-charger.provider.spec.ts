import { MockChargerProvider } from './mock-charger.provider';
import { ProviderResourceNotFoundError } from './provider-errors';

describe('MockChargerProvider', () => {
  const provider = new MockChargerProvider();

  it('returns only supported HCA G2 models with timestamps', async () => {
    const chargers = await provider.listChargers();
    expect(chargers).toHaveLength(3);
    expect(chargers.every((charger) => charger.model.match(/^GW(7|11|22)K-HCA-20$/))).toBe(true);
  });

  it('returns status and complete mock telemetry', async () => {
    await expect(provider.getChargerStatus('mock-hca-01')).resolves.toBe('CHARGING');
    await expect(provider.getTelemetry('mock-hca-01')).resolves.toMatchObject({
      externalId: 'mock-hca-01',
      powerKw: 10.8,
      currentA: 15.7,
      voltageV: 230.1,
      accumulatedEnergyKwh: 18.4,
    });
  });

  it('filters sessions by charger and date range', async () => {
    const sessions = await provider.getSessions('mock-hca-01', {
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-31T23:59:59.999Z'),
    });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.externalId).toBe('mock-session-01');
  });

  it('reports all mock capabilities as available', async () => {
    await expect(provider.healthCheck()).resolves.toMatchObject({
      provider: 'mock',
      status: 'available',
      capabilities: {
        listChargers: true,
        chargerStatus: true,
        telemetry: true,
        sessions: true,
      },
    });
  });

  it('fails explicitly for an unknown charger', async () => {
    await expect(provider.getTelemetry('unknown')).rejects.toBeInstanceOf(
      ProviderResourceNotFoundError,
    );
  });
});
