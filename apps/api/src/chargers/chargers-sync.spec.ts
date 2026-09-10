import { ChargerProvider, IntegrationStatus, ReadingSource } from '@prisma/client';
import type { ChargerProvider as ProviderContract } from './charger-provider';
import { ChargersService } from './chargers.service';
import {
  ProviderAuthenticationError,
  ProviderCapabilityNotSupportedError,
} from './provider-errors';
import type { PrismaService } from '../prisma/prisma.service';

describe('ChargersService provider synchronization', () => {
  const observedAt = new Date('2026-01-01T12:00:00.000Z');
  const externalCharger = {
    origin: 'MOCK' as const,
    externalId: 'fixture-device-001',
    serialNumber: 'FIXTURE-SERIAL-001',
    name: 'HCA G2 Fixture',
    model: 'GW11K-HCA-20' as const,
    nominalPowerKw: 11,
    phaseType: 'THREE_PHASE' as const,
    location: 'Fixture location',
  };

  function setup(telemetry: Record<string, unknown> = {}) {
    const provider: ProviderContract = {
      name: 'mock',
      listChargers: jest.fn().mockResolvedValue([externalCharger]),
      getChargerStatus: jest.fn(),
      getTelemetry: jest.fn().mockResolvedValue({
        origin: 'MOCK',
        externalId: externalCharger.externalId,
        status: 'AVAILABLE',
        powerKw: null,
        currentA: null,
        voltageV: null,
        accumulatedEnergyKwh: null,
        observedAt,
        ...telemetry,
      }),
      healthCheck: jest.fn(),
    };
    const prisma = {
      charger: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({ id: '10000000-0000-4000-8000-000000000001' }),
      },
      chargingReading: { upsert: jest.fn().mockResolvedValue({ id: 'reading-fixture' }) },
      integrationSync: { create: jest.fn().mockResolvedValue({ id: 'sync-fixture' }) },
      $transaction: jest.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations)),
    } as unknown as PrismaService;
    return { provider, prisma, service: new ChargersService(prisma, provider) };
  }

  it('is idempotent for the same charger, source and external timestamp', async () => {
    const { service, prisma } = setup({ powerKw: 4.2 });
    await service.sync();
    await service.sync();

    const calls = (prisma.chargingReading.upsert as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0].where).toEqual(calls[1][0].where);
    expect(calls[0][0].where).toEqual({
      chargerId_source_externalTimestamp: {
        chargerId: '10000000-0000-4000-8000-000000000001',
        source: ReadingSource.MOCK,
        externalTimestamp: observedAt,
      },
    });
  });

  it('persists a partial telemetry snapshot with nulls instead of failing', async () => {
    const { service, prisma } = setup();
    await expect(service.sync()).resolves.toEqual({ provider: 'mock', synchronized: 1 });
    expect(prisma.chargingReading.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ powerKw: null, currentA: null, voltageV: null }),
      }),
    );
  });

  it('keeps REAL device metadata when telemetry is unavailable without creating a MOCK reading', async () => {
    const { service, provider, prisma } = setup();
    (provider.listChargers as jest.Mock).mockResolvedValue([
      { ...externalCharger, origin: 'REAL' },
    ]);
    (provider.getTelemetry as jest.Mock).mockRejectedValue(
      new ProviderCapabilityNotSupportedError('telemetry', 'goodwe', 'fixture'),
    );

    await expect(service.sync()).resolves.toEqual({ provider: 'mock', synchronized: 1 });
    expect(prisma.charger.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ provider: ChargerProvider.GOODWE, lastSeenAt: null }),
      }),
    );
    expect(prisma.chargingReading.upsert).not.toHaveBeenCalled();
    expect(prisma.integrationSync.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: IntegrationStatus.PARTIAL,
        metadata: expect.objectContaining({ telemetryUnavailable: 1 }),
      }),
    });
  });

  it('records a sanitized failed sync when authentication is rejected', async () => {
    const { service, provider, prisma } = setup();
    (provider.listChargers as jest.Mock).mockRejectedValue(new ProviderAuthenticationError());
    await expect(service.sync()).rejects.toBeInstanceOf(ProviderAuthenticationError);
    expect(prisma.integrationSync.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: ChargerProvider.MOCK,
        status: IntegrationStatus.FAILED,
        metadata: { code: 'PROVIDER_UNAUTHORIZED' },
      }),
    });
    expect(JSON.stringify((prisma.integrationSync.create as jest.Mock).mock.calls)).not.toMatch(
      /password|token|cookie/i,
    );
  });
});
