import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataQuality, Prisma, SessionSource, SessionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { analyzeOperationalData, type IntelligenceSession } from './intelligence.analytics';

@Injectable()
export class IntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async manager(actor: AuthenticatedUser, input: { unitId?: string; days?: number }) {
    const unitId = this.resolveUnit(actor, input.unitId);
    const days = input.days ?? 90;
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    const timezone = this.timezone();
    const sessions = await this.prisma.chargingSession.findMany({
      where: {
        userId: { not: null },
        ...(unitId ? { user: { unitId } } : { user: { unitId: { not: null } } }),
        startedAt: { gte: from, lt: to },
        endedAt: { not: null },
        status: { in: [SessionStatus.COMPLETED, SessionStatus.INTERRUPTED] },
        dataQuality: DataQuality.VALID,
      },
      select: {
        id: true,
        chargerId: true,
        charger: { select: { name: true } },
        startedAt: true,
        endedAt: true,
        status: true,
        source: true,
        energyKwh: true,
        observedEnergyKwh: true,
        calculatedEnergyKwh: true,
      },
      orderBy: { startedAt: 'asc' },
    });
    const inputSessions: IntelligenceSession[] = sessions.map((session) => ({
      id: session.id,
      chargerId: session.chargerId,
      chargerName: session.charger.name,
      startedAt: session.startedAt,
      endedAt: session.endedAt!,
      energyKwh: Number(this.validatedEnergy(session)),
    }));
    return {
      ...analyzeOperationalData(inputSessions, { from, to, timezone }),
      origin: 'CALCULATED' as const,
      inputOrigins: [
        ...new Set(
          sessions.map((session) =>
            session.source === SessionSource.MOCK ? ('MOCK' as const) : ('REAL' as const),
          ),
        ),
      ],
    };
  }

  private resolveUnit(actor: AuthenticatedUser, requestedUnitId?: string) {
    if (actor.role === 'ADMIN') return requestedUnitId;
    if (!actor.unitId) throw new ForbiddenException('Gestor sem unidade associada');
    if (requestedUnitId && requestedUnitId !== actor.unitId) {
      throw new ForbiddenException('Acesso a outra unidade não permitido');
    }
    return actor.unitId;
  }

  private validatedEnergy(session: {
    status: SessionStatus;
    energyKwh: Prisma.Decimal;
    observedEnergyKwh: Prisma.Decimal | null;
    calculatedEnergyKwh: Prisma.Decimal | null;
  }) {
    return session.status === SessionStatus.INTERRUPTED
      ? (session.observedEnergyKwh ?? session.energyKwh)
      : (session.observedEnergyKwh ?? session.calculatedEnergyKwh ?? session.energyKwh);
  }

  private timezone() {
    const configured = this.config.get<string>('INTELLIGENCE_TIMEZONE') ?? 'America/Sao_Paulo';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: configured }).format();
      return configured;
    } catch {
      return 'UTC';
    }
  }
}
