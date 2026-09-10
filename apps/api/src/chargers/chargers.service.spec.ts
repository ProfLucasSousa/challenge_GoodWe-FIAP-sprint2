import {
  ChargerProvider,
  ChargerStatus,
  PhaseType,
  Prisma,
  ReadingSource,
  SessionSource,
} from '@prisma/client';
import type { ChargerProvider as ProviderContract } from './charger-provider';
import { ChargersService } from './chargers.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('ChargersService operational view', () => {
  const provider = { name: 'mock' } as ProviderContract;

  function serviceWith(charger: Record<string, unknown>) {
    const prisma = {
      charger: { findUnique: jest.fn().mockResolvedValue(charger) },
    } as unknown as PrismaService;
    return new ChargersService(prisma, provider);
  }

  const base = {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'HCA G2 - Vaga 01',
    model: 'GW11K-HCA-20',
    nominalPowerKw: new Prisma.Decimal('11'),
    phaseType: PhaseType.THREE_PHASE,
    location: 'Garagem',
    status: ChargerStatus.AVAILABLE,
    provider: ChargerProvider.MOCK,
    lastSeenAt: new Date('2026-10-12T18:00:00.000Z'),
    updatedAt: new Date('2026-10-12T18:00:00.000Z'),
  };

  it('marks absent telemetry as unavailable instead of inventing zero', async () => {
    const result = await serviceWith({ ...base, readings: [], sessions: [] }).operational(base.id);
    expect(result.metrics.powerKw).toEqual({
      value: null,
      classification: 'UNAVAILABLE',
      source: null,
      observedAt: null,
    });
    expect(result.metrics.currentA.classification).toBe('UNAVAILABLE');
    expect(result.readings).toEqual([]);
  });

  it('preserves observed zero and identifies it as mock data', async () => {
    const timestamp = new Date('2026-10-12T18:01:00.000Z');
    const result = await serviceWith({
      ...base,
      readings: [
        {
          timestamp,
          externalTimestamp: timestamp,
          powerKw: new Prisma.Decimal(0),
          currentA: new Prisma.Decimal(0),
          voltageV: new Prisma.Decimal('229.8'),
          accumulatedEnergyKwh: null,
          source: ReadingSource.MOCK,
        },
      ],
      sessions: [],
    }).operational(base.id);
    expect(Number(result.metrics.powerKw.value)).toBe(0);
    expect(result.metrics.powerKw.classification).toBe('MOCK');
    expect(result.metrics.accumulatedEnergyKwh.classification).toBe('UNAVAILABLE');
  });

  it('labels platform-derived session energy as calculated', async () => {
    const result = await serviceWith({
      ...base,
      readings: [],
      sessions: [
        {
          energyKwh: new Prisma.Decimal('7.5'),
          observedEnergyKwh: null,
          calculatedEnergyKwh: new Prisma.Decimal('7.4'),
          source: SessionSource.MANUAL,
          updatedAt: new Date('2026-10-12T18:05:00.000Z'),
        },
      ],
    }).operational(base.id);
    expect(result.metrics.sessionEnergyKwh.classification).toBe('CALCULATED');
    expect(result.metrics.sessionEnergyKwh.source).toBe('EV_CHARGEOPS');
  });
});

describe('ChargersService provider status', () => {
  it('returns operational metadata and sanitizes the last provider error', async () => {
    const provider = {
      name: 'goodwe',
      healthCheck: jest.fn().mockResolvedValue({
        provider: 'goodwe',
        status: 'unavailable',
        checkedAt: new Date('2026-10-12T18:00:00.000Z'),
        message: 'Contrato não confirmado.',
        capabilities: {
          listChargers: false,
          chargerStatus: false,
          telemetry: false,
          sessions: false,
          events: false,
          rfid: false,
          alarms: false,
          startSession: false,
          remoteControl: false,
        },
      }),
    } as unknown as ProviderContract;
    const prisma = {
      integrationSync: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            status: 'FAILED',
            startedAt: new Date('2026-10-12T17:00:00.000Z'),
            finishedAt: new Date('2026-10-12T17:00:01.000Z'),
            errorMessage: 'token=secret-value user@example.invalid',
          })
          .mockResolvedValueOnce(null),
      },
      charger: { count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;

    const result = await new ChargersService(prisma, provider).providerHealth();

    expect(result).toMatchObject({
      provider: 'goodwe',
      connected: false,
      readOnly: true,
      identifiedChargers: 0,
    });
    expect(result.lastError).toContain('token=[REDACTED]');
    expect(result.lastError).not.toContain('secret-value');
    expect(result.lastError).not.toContain('user@example.invalid');
  });
});
