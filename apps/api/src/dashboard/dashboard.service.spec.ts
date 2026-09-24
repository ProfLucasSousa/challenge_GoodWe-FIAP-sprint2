import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService authorization', () => {
  it('rejects a manager without a unit instead of falling back to global scope', async () => {
    const prisma = {
      chargingSession: { findMany: jest.fn() },
      charger: { findMany: jest.fn() },
      vehicle: { count: jest.fn() },
    } as unknown as PrismaService;
    const service = new DashboardService(prisma);
    const manager: AuthenticatedUser = {
      sub: '20000000-0000-4000-8000-000000000001',
      email: 'manager@example.invalid',
      role: 'MANAGER',
      unitId: null,
    };

    await expect(service.summary(manager, '2026-10')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chargingSession.findMany).not.toHaveBeenCalled();
  });
});
