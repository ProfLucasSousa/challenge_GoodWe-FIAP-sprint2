import type { IntelligenceService } from '../intelligence/intelligence.service';
import type { PrismaService } from '../prisma/prisma.service';
import { Prisma, SessionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { IntelligenceContextService } from './intelligence-context.service';

const unitA = '10000000-0000-4000-8000-000000000001';
const manager: AuthenticatedUser = {
  sub: 'manager',
  email: 'manager@example.invalid',
  role: 'MANAGER',
  unitId: unitA,
};

const analysis = {
  peakHours: [{ hour: '18:00', sessions: 4, percentage: 40, sampleSize: 10 }],
  chargerUtilization: [
    { chargerName: 'Vaga 01', utilizationPercent: 20, sessionCount: 8 },
    { chargerName: 'Vaga 02', utilizationPercent: 5, sessionCount: 2 },
  ],
  anomalies: [
    { type: 'ENERGY_OUTLIER', sessionId: 'must-not-leak' },
    { type: 'DURATION_OUTLIER', sessionId: 'must-not-leak-either' },
  ],
  analysisQuality: { anomalyDetection: { quality: 'MEDIUM' } },
  sampleSize: 10,
};

describe('IntelligenceContextService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('returns only aggregated manager data and strips individual anomaly identifiers', async () => {
    const sessions = [
      {
        startedAt: new Date('2026-10-05T10:00:00.000Z'),
        status: SessionStatus.COMPLETED,
        energyKwh: new Prisma.Decimal(10),
        observedEnergyKwh: new Prisma.Decimal(10),
        calculatedEnergyKwh: null,
        user: { unit: { code: 'A-101' } },
      },
      {
        startedAt: new Date('2026-09-05T10:00:00.000Z'),
        status: SessionStatus.INTERRUPTED,
        energyKwh: new Prisma.Decimal(8),
        observedEnergyKwh: new Prisma.Decimal(6),
        calculatedEnergyKwh: new Prisma.Decimal(99),
        user: { unit: { code: 'A-101' } },
      },
    ];
    const findMany = jest.fn().mockResolvedValue(sessions);
    const prisma = {
      chargingSession: { findMany },
      unit: { findUnique: jest.fn().mockResolvedValue({ code: 'A-101' }) },
    } as unknown as PrismaService;
    const intelligence = {
      manager: jest.fn().mockResolvedValue(analysis),
    } as unknown as IntelligenceService;
    const service = new IntelligenceContextService(prisma, intelligence);

    const result = await service.forManager(manager);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ user: { unitId: unitA } }) }),
    );
    expect(result.currentMonth).toMatchObject({ energyKwh: 10, sessions: 1 });
    expect(result.previousComparablePeriod).toMatchObject({ energyKwh: 6, sessions: 1 });
    expect(result.topUnit).toBeNull();
    expect(result.anomalySummary).toMatchObject({
      count: 2,
      energyOutliers: 1,
      durationOutliers: 1,
    });
    expect(JSON.stringify(result)).not.toContain('must-not-leak');
  });

  it('allows only ADMIN context to expose an aggregated top-unit ranking', async () => {
    const sessions = [
      {
        startedAt: new Date('2026-10-05T10:00:00.000Z'),
        status: SessionStatus.COMPLETED,
        energyKwh: new Prisma.Decimal(12),
        observedEnergyKwh: new Prisma.Decimal(12),
        calculatedEnergyKwh: null,
        user: { unit: { code: 'B-202' } },
      },
      {
        startedAt: new Date('2026-10-06T10:00:00.000Z'),
        status: SessionStatus.COMPLETED,
        energyKwh: new Prisma.Decimal(5),
        observedEnergyKwh: new Prisma.Decimal(5),
        calculatedEnergyKwh: null,
        user: { unit: { code: 'A-101' } },
      },
    ];
    const prisma = {
      chargingSession: { findMany: jest.fn().mockResolvedValue(sessions) },
    } as unknown as PrismaService;
    const intelligence = {
      manager: jest.fn().mockResolvedValue(analysis),
    } as unknown as IntelligenceService;
    const service = new IntelligenceContextService(prisma, intelligence);

    const result = await service.forManager({ ...manager, role: 'ADMIN', unitId: null });

    expect(result.scope.type).toBe('ALL_UNITS');
    expect(result.topUnit).toEqual({ code: 'B-202', energyKwh: 12, sessions: 1 });
  });
});
