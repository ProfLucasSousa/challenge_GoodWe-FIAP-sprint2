import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataQuality, InvoiceStatus, Prisma, SessionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import type { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from './invoices.service';

const unitId = '10000000-0000-4000-8000-000000000001';
const invoiceId = '90000000-0000-4000-8000-000000000001';
const manager: AuthenticatedUser = {
  sub: '20000000-0000-4000-8000-000000000001',
  email: 'manager@example.invalid',
  role: 'MANAGER',
  unitId,
};

function session(id: string, status: SessionStatus, observed: string, calculated = '99') {
  return {
    id,
    status,
    startedAt: new Date('2026-10-10T10:00:00.000Z'),
    energyKwh: new Prisma.Decimal(observed),
    observedEnergyKwh: new Prisma.Decimal(observed),
    calculatedEnergyKwh: new Prisma.Decimal(calculated),
  };
}

function generationHarness(options?: {
  existing?: { id: string; status: InvoiceStatus } | null;
  sessions?: ReturnType<typeof session>[];
  tariffs?: Array<{
    id: string;
    validFrom: Date;
    validUntil: Date | null;
    pricePerKwh: Prisma.Decimal;
    operationalFee: Prisma.Decimal;
  }>;
}) {
  const createMany = jest.fn().mockImplementation(({ data }) => ({ count: data.length }));
  const hasSessions = (options?.sessions?.length ?? 0) > 0;
  const aggregate = jest.fn().mockResolvedValue({
    _sum: hasSessions
      ? {
          energyKwh: new Prisma.Decimal('13.333'),
          energyAmount: new Prisma.Decimal('6.67'),
          operationalFee: new Prisma.Decimal('4.00'),
          amount: new Prisma.Decimal('10.67'),
        }
      : { energyKwh: null, energyAmount: null, operationalFee: null, amount: null },
  });
  const invoiceUpdate = jest.fn().mockResolvedValue({ id: invoiceId });
  const auditCreate = jest.fn().mockResolvedValue({ id: 'audit' });
  const tx = {
    invoice: {
      upsert: jest.fn().mockResolvedValue({ id: invoiceId, status: InvoiceStatus.OPEN }),
      update: invoiceUpdate,
    },
    invoiceItem: { createMany, aggregate },
    auditEvent: { create: auditCreate },
  };
  const prisma = {
    unit: { findUnique: jest.fn().mockResolvedValue({ id: unitId }) },
    invoice: { findUnique: jest.fn().mockResolvedValue(options?.existing ?? null) },
    chargingSession: { findMany: jest.fn().mockResolvedValue(options?.sessions ?? []) },
    tariff: { findMany: jest.fn().mockResolvedValue(options?.tariffs ?? []) },
    $transaction: jest.fn((callback) => callback(tx)),
  } as unknown as PrismaService;
  const service = new InvoicesService(prisma);
  jest.spyOn(service, 'getById').mockResolvedValue({ id: invoiceId } as never);
  return { service, prisma, tx, createMany, aggregate, invoiceUpdate, auditCreate };
}

describe('InvoicesService rateio', () => {
  it('consolidates eligible sessions and snapshots tariff values with Decimal math', async () => {
    const sessions = [
      session('completed', SessionStatus.COMPLETED, '10.000'),
      session('interrupted', SessionStatus.INTERRUPTED, '3.333', '99.000'),
    ];
    const tariff = {
      id: 'tariff',
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
      validUntil: null,
      pricePerKwh: new Prisma.Decimal('0.5000'),
      operationalFee: new Prisma.Decimal('2.00'),
    };
    const harness = generationHarness({ sessions, tariffs: [tariff] });

    await harness.service.generate(manager, unitId, '2026-10');

    expect(harness.prisma.chargingSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: { not: null },
          user: { unitId },
          endedAt: { not: null },
          status: { in: [SessionStatus.COMPLETED, SessionStatus.INTERRUPTED] },
          dataQuality: DataQuality.VALID,
          invoiceItem: null,
        }),
      }),
    );
    const inserted = harness.createMany.mock.calls[0]![0];
    expect(inserted.skipDuplicates).toBe(true);
    expect(inserted.data).toHaveLength(2);
    expect(inserted.data[0]).toMatchObject({
      chargingSessionId: 'completed',
      pricePerKwh: tariff.pricePerKwh,
      operationalFee: tariff.operationalFee,
    });
    expect(inserted.data[0].energyAmount.toString()).toBe('5');
    expect(inserted.data[0].amount.toString()).toBe('7');
    expect(inserted.data[1].energyKwh.toString()).toBe('3.333');
    expect(inserted.data[1].energyAmount.toString()).toBe('1.67');
    expect(inserted.data[1].amount.toString()).toBe('3.67');
    expect(harness.invoiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalKwh: new Prisma.Decimal('13.333'),
          energyAmount: new Prisma.Decimal('6.67'),
          operationalFees: new Prisma.Decimal('4.00'),
          totalAmount: new Prisma.Decimal('10.67'),
        }),
      }),
    );
  });

  it('creates a zero-value open invoice when there is no charging in the period', async () => {
    const harness = generationHarness();

    await harness.service.generate(manager, unitId, '2026-10');

    expect(harness.prisma.tariff.findMany).not.toHaveBeenCalled();
    expect(harness.createMany).not.toHaveBeenCalled();
    expect(harness.invoiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalAmount: new Prisma.Decimal(0) }),
      }),
    );
  });

  it('returns an existing non-open invoice without duplicating sessions', async () => {
    const harness = generationHarness({
      existing: { id: invoiceId, status: InvoiceStatus.CLOSED },
    });

    await harness.service.generate(manager, unitId, '2026-10');

    expect(harness.prisma.chargingSession.findMany).not.toHaveBeenCalled();
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
    expect(harness.service.getById).toHaveBeenCalledWith(manager, invoiceId);
  });

  it('fails atomically when an eligible session has no applicable tariff', async () => {
    const harness = generationHarness({
      sessions: [session('without-tariff', SessionStatus.COMPLETED, '5')],
      tariffs: [],
    });

    await expect(harness.service.generate(manager, unitId, '2026-10')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(harness.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('prevents a manager from generating invoices for another unit', async () => {
    const harness = generationHarness();
    await expect(
      harness.service.generate(manager, '10000000-0000-4000-8000-000000000099', '2026-10'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.prisma.unit.findUnique).not.toHaveBeenCalled();
  });

  it('returns only the authenticated USER items and recalculates the visible totals', async () => {
    const user: AuthenticatedUser = {
      sub: '20000000-0000-4000-8000-000000000010',
      email: 'user@example.invalid',
      role: 'USER',
      unitId,
    };
    const item = (id: string, userId: string, energy: string, amount: string) => ({
      id,
      invoiceId,
      chargingSessionId: `session-${id}`,
      energyKwh: new Prisma.Decimal(energy),
      pricePerKwh: new Prisma.Decimal('1.0000'),
      energyAmount: new Prisma.Decimal(energy),
      operationalFee: new Prisma.Decimal('2.00'),
      amount: new Prisma.Decimal(amount),
      chargingSession: { userId },
    });
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: invoiceId,
            unitId,
            referenceMonth: '2026-10',
            status: InvoiceStatus.OPEN,
            totalKwh: new Prisma.Decimal('15'),
            energyAmount: new Prisma.Decimal('15'),
            operationalFees: new Prisma.Decimal('4'),
            totalAmount: new Prisma.Decimal('19'),
            generatedAt: new Date(),
            closedAt: null,
            updatedAt: new Date(),
            unit: { id: unitId },
            items: [
              item('own', user.sub, '5', '7'),
              item('other', '20000000-0000-4000-8000-000000000099', '10', '12'),
            ],
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new InvoicesService(prisma);

    const result = await service.list(user, {});

    expect(result[0]?.items).toHaveLength(1);
    expect(result[0]?.items[0]?.id).toBe('own');
    expect(result[0]?.totalKwh.toString()).toBe('5');
    expect(result[0]?.totalAmount.toString()).toBe('7');
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          unitId,
          items: { some: { chargingSession: { userId: user.sub } } },
        }),
      }),
    );
  });

  it('closes an open invoice once and records an audit event', async () => {
    const invoice = {
      id: invoiceId,
      unitId,
      referenceMonth: '2026-10',
      status: InvoiceStatus.OPEN,
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit' });
    const prisma = {
      invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
      $transaction: jest.fn((callback) =>
        callback({ invoice: { updateMany }, auditEvent: { create: auditCreate } }),
      ),
    } as unknown as PrismaService;
    const service = new InvoicesService(prisma);
    jest.spyOn(service, 'getById').mockResolvedValue({ id: invoiceId } as never);

    await service.close(manager, invoiceId);

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: invoiceId, status: InvoiceStatus.OPEN },
      data: { status: InvoiceStatus.CLOSED, closedAt: expect.any(Date) },
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'INVOICE_CLOSED' }),
    });
  });

  it('is idempotent when closing an invoice that is already closed', async () => {
    const prisma = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: invoiceId,
          unitId,
          status: InvoiceStatus.CLOSED,
        }),
      },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new InvoicesService(prisma);
    jest.spyOn(service, 'getById').mockResolvedValue({ id: invoiceId } as never);

    await service.close(manager, invoiceId);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not duplicate the close audit during concurrent requests', async () => {
    const auditCreate = jest.fn();
    const prisma = {
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: invoiceId,
          unitId,
          referenceMonth: '2026-10',
          status: InvoiceStatus.OPEN,
        }),
      },
      $transaction: jest.fn((callback) =>
        callback({
          invoice: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
          auditEvent: { create: auditCreate },
        }),
      ),
    } as unknown as PrismaService;
    const service = new InvoicesService(prisma);
    jest.spyOn(service, 'getById').mockResolvedValue({ id: invoiceId } as never);

    await service.close(manager, invoiceId);

    expect(auditCreate).not.toHaveBeenCalled();
  });
});
