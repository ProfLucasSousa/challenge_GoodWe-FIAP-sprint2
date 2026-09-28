import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataQuality, Prisma, SessionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { IntelligenceService } from './intelligence.service';

describe('IntelligenceService', () => {
  const manager: AuthenticatedUser = {
    sub: 'manager',
    email: 'manager@example.invalid',
    role: 'MANAGER',
    unitId: '10000000-0000-4000-8000-000000000001',
  };
  const config = {
    get: jest.fn().mockReturnValue('UTC'),
  } as unknown as ConfigService;

  it('scopes manager data to the assigned unit and only queries valid finished sessions', async () => {
    const startedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'session',
        chargerId: 'charger',
        charger: { name: 'Charger' },
        startedAt,
        endedAt: new Date(startedAt.getTime() + 60 * 60 * 1000),
        status: SessionStatus.INTERRUPTED,
        energyKwh: new Prisma.Decimal(5),
        observedEnergyKwh: new Prisma.Decimal(4),
        calculatedEnergyKwh: new Prisma.Decimal(99),
      },
    ]);
    const prisma = { chargingSession: { findMany } } as unknown as PrismaService;
    const service = new IntelligenceService(prisma, config);

    const result = await service.manager(manager, { days: 90 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: { unitId: manager.unitId },
          endedAt: { not: null },
          status: { in: [SessionStatus.COMPLETED, SessionStatus.INTERRUPTED] },
          dataQuality: DataQuality.VALID,
        }),
      }),
    );
    expect(result.averageSessionEnergy).toBe(4);
  });

  it('rejects cross-unit manager analysis before querying data', async () => {
    const findMany = jest.fn();
    const service = new IntelligenceService(
      { chargingSession: { findMany } } as unknown as PrismaService,
      config,
    );

    await expect(
      service.manager(manager, {
        unitId: '10000000-0000-4000-8000-000000000099',
        days: 90,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
