import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataQuality, InvoiceStatus, Prisma, SessionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { publicUserSelect } from '../users/user-select';

export interface InvoiceFilter {
  unitId?: string;
  referenceMonth?: string;
  status?: InvoiceStatus;
}

const invoiceInclude = {
  unit: true,
  items: {
    include: {
      chargingSession: {
        include: { user: { select: publicUserSelect }, vehicle: true, charger: true },
      },
    },
    orderBy: { chargingSession: { startedAt: 'asc' } },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceDetails = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser, filter: InvoiceFilter) {
    if (filter.referenceMonth) this.monthRange(filter.referenceMonth);
    const unitId = this.scopedUnitId(user, filter.unitId);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...(unitId ? { unitId } : {}),
        ...(filter.referenceMonth ? { referenceMonth: filter.referenceMonth } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(user.role === 'USER'
          ? { items: { some: { chargingSession: { userId: user.sub } } } }
          : {}),
      },
      include: invoiceInclude,
      orderBy: [{ referenceMonth: 'desc' }, { generatedAt: 'desc' }],
    });
    const scoped =
      user.role === 'USER' ? invoices.map((invoice) => this.userView(invoice, user.sub)) : invoices;
    return scoped.map((invoice) => this.withOrigin(invoice));
  }

  async getById(user: AuthenticatedUser, id: string) {
    const header = await this.prisma.invoice.findUnique({
      where: { id },
      select: { unitId: true },
    });
    if (!header) throw new NotFoundException('Fatura não encontrada');
    this.assertUnitAccess(user, header.unitId);
    const invoice = await this.prisma.invoice.findUnique({
      where: {
        id,
        ...(user.role === 'USER'
          ? { items: { some: { chargingSession: { userId: user.sub } } } }
          : {}),
      },
      include: invoiceInclude,
    });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    return this.withOrigin(user.role === 'USER' ? this.userView(invoice, user.sub) : invoice);
  }

  async generate(user: AuthenticatedUser, unitId: string, referenceMonth: string) {
    this.assertUnitAccess(user, unitId);
    const { start, end } = this.monthRange(referenceMonth);
    const unit = await this.prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
    if (!unit) throw new NotFoundException('Unidade não encontrada');

    const existing = await this.prisma.invoice.findUnique({
      where: { unitId_referenceMonth: { unitId, referenceMonth } },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== InvoiceStatus.OPEN) {
      return this.getById(user, existing.id);
    }

    const sessions = await this.prisma.chargingSession.findMany({
      where: {
        userId: { not: null },
        user: { unitId },
        startedAt: { gte: start, lt: end },
        endedAt: { not: null },
        status: { in: [SessionStatus.COMPLETED, SessionStatus.INTERRUPTED] },
        dataQuality: DataQuality.VALID,
        invoiceItem: null,
      },
      orderBy: { startedAt: 'asc' },
    });
    const billableSessions = sessions
      .map((session) => ({ session, energyKwh: this.validatedEnergy(session) }))
      .filter(({ energyKwh }) => energyKwh.greaterThan(0));

    const tariffs = billableSessions.length
      ? await this.prisma.tariff.findMany({
          where: {
            active: true,
            validFrom: { lt: end },
            OR: [{ validUntil: null }, { validUntil: { gte: start } }],
          },
          orderBy: { validFrom: 'desc' },
        })
      : [];
    const items = billableSessions.map(({ session, energyKwh }) => {
      const tariff = tariffs.find(
        (candidate) =>
          candidate.validFrom <= session.startedAt &&
          (!candidate.validUntil || candidate.validUntil >= session.startedAt),
      );
      if (!tariff) {
        throw new BadRequestException(
          `Nenhuma tarifa válida para a sessão ${session.id} no período informado`,
        );
      }
      const energyAmount = energyKwh
        .mul(tariff.pricePerKwh)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      const operationalFee = new Prisma.Decimal(tariff.operationalFee).toDecimalPlaces(2);
      return {
        chargingSessionId: session.id,
        energyKwh,
        pricePerKwh: tariff.pricePerKwh,
        energyAmount,
        operationalFee,
        amount: energyAmount.add(operationalFee).toDecimalPlaces(2),
      };
    });

    const invoiceId = await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.upsert({
        where: { unitId_referenceMonth: { unitId, referenceMonth } },
        create: { unitId, referenceMonth, status: InvoiceStatus.OPEN },
        update: {},
      });
      if (invoice.status !== InvoiceStatus.OPEN) return invoice.id;

      const inserted = items.length
        ? await tx.invoiceItem.createMany({
            data: items.map((item) => ({ ...item, invoiceId: invoice.id })),
            skipDuplicates: true,
          })
        : { count: 0 };
      const totals = await tx.invoiceItem.aggregate({
        where: { invoiceId: invoice.id },
        _sum: {
          energyKwh: true,
          energyAmount: true,
          operationalFee: true,
          amount: true,
        },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          totalKwh: totals._sum.energyKwh ?? new Prisma.Decimal(0),
          energyAmount: totals._sum.energyAmount ?? new Prisma.Decimal(0),
          operationalFees: totals._sum.operationalFee ?? new Prisma.Decimal(0),
          totalAmount: totals._sum.amount ?? new Prisma.Decimal(0),
        },
      });
      if (inserted.count > 0 || (!existing && items.length === 0)) {
        await tx.auditEvent.create({
          data: {
            type: 'INVOICE_GENERATED',
            userId: user.sub,
            message: 'Fatura mensal gerada ou atualizada.',
            metadata: { referenceMonth, insertedItems: inserted.count },
          },
        });
      }
      return invoice.id;
    });
    return this.getById(user, invoiceId);
  }

  async close(user: AuthenticatedUser, id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Fatura não encontrada');
    this.assertUnitAccess(user, invoice.unitId);
    if (invoice.status === InvoiceStatus.CLOSED || invoice.status === InvoiceStatus.PAID) {
      return this.getById(user, id);
    }
    if (invoice.status !== InvoiceStatus.OPEN) {
      throw new BadRequestException('Somente faturas abertas podem ser fechadas');
    }
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.invoice.updateMany({
        where: { id, status: InvoiceStatus.OPEN },
        data: { status: InvoiceStatus.CLOSED, closedAt: new Date() },
      });
      if (changed.count === 0) return;
      await tx.auditEvent.create({
        data: {
          type: 'INVOICE_CLOSED',
          userId: user.sub,
          message: 'Fatura mensal fechada.',
          metadata: { invoiceId: id, referenceMonth: invoice.referenceMonth },
        },
      });
    });
    return this.getById(user, id);
  }

  private assertUnitAccess(user: AuthenticatedUser, unitId: string) {
    if (user.role !== 'ADMIN' && user.unitId !== unitId) {
      throw new ForbiddenException('Acesso a outra unidade não permitido');
    }
  }

  private scopedUnitId(user: AuthenticatedUser, requestedUnitId?: string) {
    if (user.role === 'ADMIN') return requestedUnitId;
    if (requestedUnitId && requestedUnitId !== user.unitId) {
      throw new ForbiddenException('Acesso a outra unidade não permitido');
    }
    return user.unitId ?? '__no_unit__';
  }

  private validatedEnergy(session: {
    status: SessionStatus;
    energyKwh: Prisma.Decimal;
    observedEnergyKwh: Prisma.Decimal | null;
    calculatedEnergyKwh: Prisma.Decimal | null;
  }) {
    const energy =
      session.status === SessionStatus.INTERRUPTED
        ? (session.observedEnergyKwh ?? session.energyKwh)
        : (session.observedEnergyKwh ?? session.calculatedEnergyKwh ?? session.energyKwh);
    return new Prisma.Decimal(energy).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
  }

  private userView(invoice: InvoiceDetails, userId: string) {
    const items = invoice.items.filter((item) => item.chargingSession.userId === userId);
    const sum = (field: 'energyKwh' | 'energyAmount' | 'operationalFee' | 'amount') =>
      items.reduce((total, item) => total.add(item[field]), new Prisma.Decimal(0));
    return {
      ...invoice,
      items,
      totalKwh: sum('energyKwh'),
      energyAmount: sum('energyAmount'),
      operationalFees: sum('operationalFee'),
      totalAmount: sum('amount'),
    };
  }

  private withOrigin(invoice: InvoiceDetails | ReturnType<InvoicesService['userView']>) {
    return {
      ...invoice,
      origin: 'CALCULATED' as const,
      inputOrigins: [
        ...new Set(
          invoice.items.map((item) =>
            item.chargingSession.source === 'MOCK' ? ('MOCK' as const) : ('REAL' as const),
          ),
        ),
      ],
      items: invoice.items.map((item) => ({
        ...item,
        origin: 'CALCULATED' as const,
        inputOrigin: item.chargingSession.source === 'MOCK' ? ('MOCK' as const) : ('REAL' as const),
      })),
    };
  }

  private monthRange(month: string) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Mês inválido');
    const [year, monthNumber] = month.split('-').map(Number);
    return {
      start: new Date(Date.UTC(year!, monthNumber! - 1, 1)),
      end: new Date(Date.UTC(year!, monthNumber!, 1)),
    };
  }
}
