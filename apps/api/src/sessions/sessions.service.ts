import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditSeverity,
  ChargerProvider as ChargerProviderEnum,
  ChargerStatus,
  DataQuality,
  SessionSource,
  SessionStatus,
  SessionType,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import type { ChargerProvider } from '../chargers/charger-provider';
import { GoodWeSemsProvider } from '../chargers/goodwe-sems.provider';
import { MockChargerProvider } from '../chargers/mock-charger.provider';
import { PrismaService } from '../prisma/prisma.service';

interface CreateSessionInput {
  chargerId: string;
  vehicleId: string;
  rfidCardId?: string;
  startedAt: string;
}

interface FinishSessionInput {
  endedAt: string;
  energyKwh: number;
  averagePowerKw?: number;
  interrupted: boolean;
  validated: boolean;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mockProvider: MockChargerProvider,
    private readonly goodweProvider: GoodWeSemsProvider,
  ) {}

  async list(user: AuthenticatedUser, filter: { month?: string; userId?: string }) {
    const requestedUserId = user.role === 'USER' ? user.sub : filter.userId;
    const dateFilter = this.monthRange(filter.month);
    const managerAccess =
      user.role === 'MANAGER' ? { OR: [{ user: { unitId: user.unitId } }, { userId: null }] } : {};
    const sessions = await this.prisma.chargingSession.findMany({
      where: {
        ...(requestedUserId ? { userId: requestedUserId } : {}),
        ...managerAccess,
        ...(dateFilter ? { startedAt: dateFilter } : {}),
      },
      include: {
        user: { select: { id: true, name: true, unit: { select: { code: true } } } },
        vehicle: { select: { model: true, licensePlate: true } },
        charger: { select: { name: true, location: true } },
        invoiceItem: { select: { amount: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    return sessions.map((session) => this.withSessionOrigin(session));
  }

  async getById(user: AuthenticatedUser, id: string) {
    const session = await this.prisma.chargingSession.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, unitId: true } },
        vehicle: { select: { id: true, model: true, licensePlate: true, ownerId: true } },
        rfidCard: { select: { id: true, uid: true, userId: true } },
        charger: true,
        readings: { orderBy: { timestamp: 'desc' }, take: 100 },
        invoiceItem: true,
      },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');
    this.assertSessionAccess(user, session.userId, session.user?.unitId ?? null);
    return {
      ...this.withSessionOrigin(session),
      readings: session.readings.map((reading) => ({
        ...reading,
        origin: reading.source === 'MOCK' ? ('MOCK' as const) : ('REAL' as const),
      })),
    };
  }

  async start(user: AuthenticatedUser, input: CreateSessionInput) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: input.vehicleId } });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado');
    if (!vehicle.active || vehicle.ownerId !== user.sub) {
      throw new ForbiddenException('Veículo inválido para o usuário');
    }

    const charger = await this.prisma.charger.findUnique({ where: { id: input.chargerId } });
    if (!charger) throw new NotFoundException('Carregador não encontrado');
    const providerHealth = await this.providerFor(charger.provider).healthCheck();
    if (providerHealth.status !== 'available' || !providerHealth.capabilities.startSession) {
      throw new BadRequestException('O provider não permite iniciar sessões pelo EV ChargeOps');
    }

    if (input.rfidCardId) {
      const card = await this.prisma.rfidCard.findUnique({ where: { id: input.rfidCardId } });
      if (!card?.active || card.userId !== user.sub) {
        throw new ForbiddenException('Cartão RFID inválido para o usuário');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const acquired = await tx.charger.updateMany({
        where: { id: input.chargerId, status: ChargerStatus.AVAILABLE },
        data: { status: ChargerStatus.CHARGING },
      });
      if (acquired.count !== 1) {
        throw new BadRequestException('Carregador indisponível para iniciar uma sessão');
      }

      const session = await tx.chargingSession.create({
        data: {
          userId: user.sub,
          vehicleId: input.vehicleId,
          chargerId: input.chargerId,
          rfidCardId: input.rfidCardId,
          startedAt: new Date(input.startedAt),
          sessionType: SessionType.INTERNAL,
          source: SessionSource.MOCK,
          dataQuality: DataQuality.VALID,
        },
      });
      await tx.auditEvent.create({
        data: {
          type: 'SESSION_STARTED',
          severity: AuditSeverity.INFO,
          userId: user.sub,
          chargerId: input.chargerId,
          chargingSessionId: session.id,
          message: 'Sessão de recarga iniciada manualmente.',
        },
      });
      return session;
    });
  }

  async finish(user: AuthenticatedUser, id: string, input: FinishSessionInput) {
    const session = await this.prisma.chargingSession.findUnique({
      where: { id },
      include: { user: { select: { unitId: true } } },
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');
    this.assertSessionAccess(user, session.userId, session.user?.unitId ?? null);
    if (session.sessionType !== SessionType.INTERNAL) {
      throw new BadRequestException(
        'Sessões importadas são finalizadas somente pela fonte externa.',
      );
    }
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('A sessão já foi finalizada');
    }
    const endedAt = new Date(input.endedAt);
    if (endedAt <= session.startedAt)
      throw new BadRequestException('Fim deve ser posterior ao início');

    const status = !input.validated
      ? SessionStatus.PENDING_REVIEW
      : input.interrupted
        ? SessionStatus.INTERRUPTED
        : SessionStatus.COMPLETED;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.chargingSession.update({
        where: { id },
        data: {
          endedAt,
          energyKwh: input.energyKwh,
          observedEnergyKwh: input.energyKwh,
          averagePowerKw: input.averagePowerKw,
          status,
          dataQuality: input.validated ? DataQuality.VALID : DataQuality.PARTIAL,
          reviewReason: input.validated ? null : 'Energia observada requer validação manual.',
        },
      });
      await tx.charger.update({
        where: { id: session.chargerId },
        data: { status: ChargerStatus.AVAILABLE },
      });
      await tx.auditEvent.create({
        data: {
          type: 'SESSION_FINISHED',
          severity: AuditSeverity.INFO,
          userId: user.sub,
          chargerId: session.chargerId,
          chargingSessionId: id,
          message: 'Sessão de recarga finalizada.',
          metadata: { status },
        },
      });
      return updated;
    });
  }

  async assignUser(actor: AuthenticatedUser, id: string, userId: string) {
    const session = await this.findSessionForAssignment(id);
    this.assertSessionAccess(actor, session.userId, session.user?.unitId ?? null);
    this.assertNotInvoiced(session.invoiceItem);
    if (session.userId === userId) return session;

    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target?.active) throw new NotFoundException('Usuário ativo não encontrado');
    this.assertManagerUnit(actor, target.unitId);
    if (session.vehicle && session.vehicle.ownerId !== target.id) {
      throw new BadRequestException('O veículo associado pertence a outro usuário');
    }
    if (session.rfidCard && session.rfidCard.userId !== target.id) {
      throw new BadRequestException('O cartão RFID associado pertence a outro usuário');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.chargingSession.update({
        where: { id },
        data: { userId, ...this.reviewUpdate(session, userId) },
      });
      await tx.auditEvent.create({
        data: {
          type: 'SESSION_USER_ASSIGNED',
          severity: AuditSeverity.INFO,
          userId: actor.sub,
          chargerId: session.chargerId,
          chargingSessionId: id,
          message: 'Usuário associado manualmente à sessão.',
          metadata: { assignedUserId: userId },
        },
      });
      return updated;
    });
  }

  async assignVehicle(actor: AuthenticatedUser, id: string, vehicleId: string) {
    const session = await this.findSessionForAssignment(id);
    this.assertSessionAccess(actor, session.userId, session.user?.unitId ?? null);
    this.assertNotInvoiced(session.invoiceItem);
    if (session.vehicleId === vehicleId) return session;

    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      include: { owner: { select: { unitId: true } } },
    });
    if (!vehicle?.active) throw new NotFoundException('Veículo ativo não encontrado');
    this.assertManagerUnit(actor, vehicle.owner.unitId);
    if (session.userId && vehicle.ownerId !== session.userId) {
      throw new BadRequestException('O veículo não pertence ao usuário associado');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.chargingSession.update({
        where: { id },
        data: { vehicleId, ...this.reviewUpdate(session, session.userId) },
      });
      await tx.auditEvent.create({
        data: {
          type: 'SESSION_VEHICLE_ASSIGNED',
          severity: AuditSeverity.INFO,
          userId: actor.sub,
          chargerId: session.chargerId,
          chargingSessionId: id,
          message: 'Veículo associado manualmente à sessão.',
          metadata: { assignedVehicleId: vehicleId },
        },
      });
      return updated;
    });
  }

  async assignRfid(actor: AuthenticatedUser, id: string, rfidCardId: string) {
    const session = await this.findSessionForAssignment(id);
    this.assertSessionAccess(actor, session.userId, session.user?.unitId ?? null);
    this.assertNotInvoiced(session.invoiceItem);
    if (session.rfidCardId === rfidCardId) return session;

    const card = await this.prisma.rfidCard.findUnique({
      where: { id: rfidCardId },
      include: { user: { select: { unitId: true } } },
    });
    if (!card?.active) throw new NotFoundException('Cartão RFID ativo não encontrado');
    this.assertManagerUnit(actor, card.user.unitId);
    if (session.userId && card.userId !== session.userId) {
      throw new BadRequestException('O cartão RFID não pertence ao usuário associado');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.chargingSession.update({
        where: { id },
        data: { rfidCardId, ...this.reviewUpdate(session, session.userId) },
      });
      await tx.auditEvent.create({
        data: {
          type: 'SESSION_RFID_ASSIGNED',
          severity: AuditSeverity.INFO,
          userId: actor.sub,
          chargerId: session.chargerId,
          chargingSessionId: id,
          message: 'Cartão RFID associado manualmente à sessão.',
          metadata: { assignedRfidCardId: rfidCardId },
        },
      });
      return updated;
    });
  }

  async tryAssociateImportedRfid(id: string, identifiableUid: string | null) {
    const session = await this.findSessionForAssignment(id);
    if (session.sessionType !== SessionType.IMPORTED) {
      throw new BadRequestException('Associação automática RFID é exclusiva de sessões importadas');
    }

    const card = identifiableUid
      ? await this.prisma.rfidCard.findUnique({
          where: { uid: identifiableUid },
          include: { user: { select: { active: true } } },
        })
      : null;
    const safeMatch =
      card?.active &&
      card.user.active &&
      (!session.userId || session.userId === card.userId) &&
      (!session.rfidCardId || session.rfidCardId === card.id);

    if (!safeMatch || !card) {
      return this.prisma.chargingSession.update({
        where: { id },
        data: {
          status: SessionStatus.PENDING_REVIEW,
          reviewReason: 'RFID externo ausente, desconhecido, inativo ou conflitante.',
        },
      });
    }
    if (session.userId === card.userId && session.rfidCardId === card.id) return session;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.chargingSession.update({
        where: { id },
        data: {
          userId: card.userId,
          rfidCardId: card.id,
          ...this.reviewUpdate(session, card.userId),
        },
      });
      await tx.auditEvent.create({
        data: {
          type: 'SESSION_RFID_AUTO_ASSOCIATED',
          severity: AuditSeverity.INFO,
          userId: card.userId,
          chargerId: session.chargerId,
          chargingSessionId: id,
          message: 'Sessão importada associada por correspondência RFID exata.',
          metadata: { rfidCardId: card.id },
        },
      });
      return updated;
    });
  }

  private findSessionForAssignment(id: string) {
    return this.prisma.chargingSession
      .findUnique({
        where: { id },
        include: {
          user: { select: { unitId: true } },
          vehicle: { select: { ownerId: true } },
          rfidCard: { select: { userId: true } },
          invoiceItem: { select: { id: true } },
        },
      })
      .then((session) => {
        if (!session) throw new NotFoundException('Sessão não encontrada');
        return session;
      });
  }

  private reviewUpdate(
    session: {
      sessionType: SessionType;
      endedAt: Date | null;
      observedEnergyKwh: { toString(): string } | null;
      calculatedEnergyKwh: { toString(): string } | null;
      energyKwh: { toString(): string };
      observedStatus: SessionStatus | null;
      dataQuality: DataQuality;
    },
    userId: string | null,
  ) {
    if (session.sessionType !== SessionType.IMPORTED) return {};
    const energy = Number(
      session.observedEnergyKwh ?? session.calculatedEnergyKwh ?? session.energyKwh,
    );
    const observedStatus = session.observedStatus;
    const billableStatus =
      observedStatus === SessionStatus.COMPLETED || observedStatus === SessionStatus.INTERRUPTED;
    if (!userId || !session.endedAt || energy <= 0 || session.dataQuality !== DataQuality.VALID) {
      return {
        status: SessionStatus.PENDING_REVIEW,
        reviewReason: 'Sessão importada sem identificação ou dados válidos para faturamento.',
      };
    }
    if (!billableStatus) {
      return {
        status: SessionStatus.PENDING_REVIEW,
        reviewReason: 'Status externo ainda não permite faturamento automático.',
      };
    }
    return { status: observedStatus, reviewReason: null };
  }

  private assertSessionAccess(
    actor: AuthenticatedUser,
    sessionUserId: string | null,
    sessionUnitId: string | null,
  ) {
    if (actor.role === 'ADMIN') return;
    if (actor.role === 'USER' && sessionUserId !== actor.sub) {
      throw new ForbiddenException('Sessão não pertence ao usuário');
    }
    if (actor.role === 'MANAGER' && sessionUnitId && sessionUnitId !== actor.unitId) {
      throw new ForbiddenException('Sessão pertence a outra unidade');
    }
  }

  private assertManagerUnit(actor: AuthenticatedUser, targetUnitId: string | null) {
    if (actor.role === 'MANAGER' && (!actor.unitId || targetUnitId !== actor.unitId)) {
      throw new ForbiddenException('Associação fora da unidade do gestor');
    }
  }

  private assertNotInvoiced(invoiceItem: { id: string } | null) {
    if (invoiceItem) {
      throw new BadRequestException('Uma sessão já faturada não pode ser reassociada');
    }
  }

  private providerFor(provider: ChargerProviderEnum): ChargerProvider {
    return provider === ChargerProviderEnum.GOODWE ? this.goodweProvider : this.mockProvider;
  }

  private withSessionOrigin<
    T extends {
      source: SessionSource;
      observedEnergyKwh: unknown | null;
      calculatedEnergyKwh: unknown | null;
    },
  >(session: T) {
    const origin =
      session.source === SessionSource.MOCK
        ? ('MOCK' as const)
        : session.observedEnergyKwh == null && session.calculatedEnergyKwh != null
          ? ('CALCULATED' as const)
          : ('REAL' as const);
    return { ...session, origin };
  }

  private monthRange(month?: string) {
    if (!month) return undefined;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException('Mês inválido');
    const [year, monthNumber] = month.split('-').map(Number);
    return {
      gte: new Date(Date.UTC(year!, monthNumber! - 1, 1)),
      lt: new Date(Date.UTC(year!, monthNumber!, 1)),
    };
  }
}
