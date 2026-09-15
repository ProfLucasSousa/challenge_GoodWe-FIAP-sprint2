import { BadRequestException } from '@nestjs/common';
import { ChargerProvider, DataQuality, Prisma, SessionStatus, SessionType } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import type { GoodWeSemsProvider } from '../chargers/goodwe-sems.provider';
import type { MockChargerProvider } from '../chargers/mock-charger.provider';
import type { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from './sessions.service';

const admin: AuthenticatedUser = {
  sub: '20000000-0000-4000-8000-000000000001',
  email: 'admin@example.invalid',
  role: 'ADMIN',
  unitId: null,
};

function importedSession(overrides: Record<string, unknown> = {}) {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    userId: null,
    chargerId: '50000000-0000-4000-8000-000000000001',
    startedAt: new Date('2026-10-10T10:00:00.000Z'),
    endedAt: new Date('2026-10-10T11:00:00.000Z'),
    energyKwh: new Prisma.Decimal(8.5),
    observedEnergyKwh: new Prisma.Decimal(8.5),
    sessionType: SessionType.IMPORTED,
    status: SessionStatus.PENDING_REVIEW,
    observedStatus: SessionStatus.COMPLETED,
    dataQuality: DataQuality.VALID,
    user: null,
    vehicle: null,
    rfidCard: null,
    invoiceItem: null,
    ...overrides,
  };
}

describe('SessionsService', () => {
  const availableMock = {
    healthCheck: jest.fn().mockResolvedValue({
      status: 'available',
      capabilities: { startSession: true },
    }),
  } as unknown as MockChargerProvider;

  it('does not start when the selected provider lacks the capability', async () => {
    const prisma = {
      vehicle: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'vehicle', active: true, ownerId: admin.sub }),
      },
      charger: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'charger', provider: ChargerProvider.GOODWE }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const unavailableGoodWe = {
      healthCheck: jest.fn().mockResolvedValue({
        status: 'unavailable',
        capabilities: { startSession: false },
      }),
    } as unknown as GoodWeSemsProvider;
    const service = new SessionsService(prisma, availableMock, unavailableGoodWe);

    await expect(
      service.start(admin, {
        chargerId: 'charger',
        vehicleId: 'vehicle',
        startedAt: '2026-10-10T10:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction as jest.Mock).not.toHaveBeenCalled();
  });

  it('never finishes an imported session through the internal endpoint', async () => {
    const prisma = {
      chargingSession: { findUnique: jest.fn().mockResolvedValue(importedSession()) },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new SessionsService(prisma, availableMock, {} as GoodWeSemsProvider);

    await expect(
      service.finish(admin, 'session', {
        endedAt: '2026-10-10T12:00:00.000Z',
        energyKwh: 99,
        interrupted: false,
        validated: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction as jest.Mock).not.toHaveBeenCalled();
  });

  it('assigns a user, restores the observed status and audits without changing energy', async () => {
    const session = importedSession();
    const update = jest.fn().mockResolvedValue({ ...session, userId: 'target-user' });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit' });
    const transactionClient = {
      chargingSession: { update },
      auditEvent: { create: auditCreate },
    };
    const prisma = {
      chargingSession: { findUnique: jest.fn().mockResolvedValue(session) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'target-user',
          active: true,
          unitId: 'unit-a',
        }),
      },
      $transaction: jest.fn((callback) => callback(transactionClient)),
    } as unknown as PrismaService;
    const service = new SessionsService(prisma, availableMock, {} as GoodWeSemsProvider);

    await service.assignUser(admin, session.id, 'target-user');

    expect(update).toHaveBeenCalledWith({
      where: { id: session.id },
      data: {
        userId: 'target-user',
        status: SessionStatus.COMPLETED,
        reviewReason: null,
      },
    });
    expect(update.mock.calls[0]?.[0].data).not.toHaveProperty('energyKwh');
    expect(update.mock.calls[0]?.[0].data).not.toHaveProperty('observedEnergyKwh');
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'SESSION_USER_ASSIGNED',
        chargingSessionId: session.id,
        metadata: { assignedUserId: 'target-user' },
      }),
    });
  });

  it('keeps an imported session pending when billing data is insufficient', async () => {
    const session = importedSession({
      observedStatus: null,
    });
    const update = jest.fn().mockResolvedValue(session);
    const transactionClient = {
      chargingSession: { update },
      auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit' }) },
    };
    const prisma = {
      chargingSession: { findUnique: jest.fn().mockResolvedValue(session) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'target-user',
          active: true,
          unitId: 'unit-a',
        }),
      },
      $transaction: jest.fn((callback) => callback(transactionClient)),
    } as unknown as PrismaService;
    const service = new SessionsService(prisma, availableMock, {} as GoodWeSemsProvider);

    await service.assignUser(admin, session.id, 'target-user');

    expect(update).toHaveBeenCalledWith({
      where: { id: session.id },
      data: expect.objectContaining({
        userId: 'target-user',
        status: SessionStatus.PENDING_REVIEW,
      }),
    });
  });

  it('auto-associates only an exact active RFID match without recording the UID', async () => {
    const session = importedSession();
    const update = jest.fn().mockResolvedValue({ ...session, userId: 'rfid-user' });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit' });
    const prisma = {
      chargingSession: { findUnique: jest.fn().mockResolvedValue(session) },
      rfidCard: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rfid-card',
          uid: 'EXACT-UID',
          userId: 'rfid-user',
          active: true,
          user: { active: true },
        }),
      },
      $transaction: jest.fn((callback) =>
        callback({ chargingSession: { update }, auditEvent: { create: auditCreate } }),
      ),
    } as unknown as PrismaService;
    const service = new SessionsService(prisma, availableMock, {} as GoodWeSemsProvider);

    await service.tryAssociateImportedRfid(session.id, 'EXACT-UID');

    expect(prisma.rfidCard.findUnique as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { uid: 'EXACT-UID' } }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: session.id },
      data: expect.objectContaining({ userId: 'rfid-user', rfidCardId: 'rfid-card' }),
    });
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('EXACT-UID');
  });

  it('keeps an imported session pending when RFID has no safe match', async () => {
    const session = importedSession();
    const update = jest.fn().mockResolvedValue(session);
    const prisma = {
      chargingSession: { findUnique: jest.fn().mockResolvedValue(session), update },
      rfidCard: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const service = new SessionsService(prisma, availableMock, {} as GoodWeSemsProvider);

    await service.tryAssociateImportedRfid(session.id, 'UNKNOWN-UID');

    expect(update).toHaveBeenCalledWith({
      where: { id: session.id },
      data: expect.objectContaining({ status: SessionStatus.PENDING_REVIEW }),
    });
  });
});
