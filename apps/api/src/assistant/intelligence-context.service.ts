import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataQuality, Prisma, SessionStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { IntelligenceService } from '../intelligence/intelligence.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AssistantIntelligenceContext {
  scope: { type: 'ALL_UNITS' | 'UNIT'; unitCode: string | null };
  currentMonth: { reference: string; energyKwh: number; sessions: number };
  previousComparablePeriod: { reference: string; energyKwh: number; sessions: number };
  monthComparison: {
    direction: 'INCREASE' | 'DECREASE' | 'STABLE' | 'NO_BASELINE';
    percentage: number | null;
  };
  peakHour: {
    hour: string;
    sessions: number;
    percentage: number;
    sampleSize: number;
  } | null;
  anomalySummary: {
    count: number;
    energyOutliers: number;
    durationOutliers: number;
    method: 'IQR';
    quality: string;
    sampleSize: number;
  };
  mostIdleCharger: {
    name: string;
    utilizationPercent: number;
    idlePercent: number;
    observedSessions: number;
  } | null;
  topUnit: { code: string; energyKwh: number; sessions: number } | null;
}

@Injectable()
export class IntelligenceContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly intelligence: IntelligenceService,
  ) {}

  async forManager(actor: AuthenticatedUser): Promise<AssistantIntelligenceContext> {
    if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
      throw new ForbiddenException('Síndico Virtual disponível somente para gestores');
    }
    if (actor.role === 'MANAGER' && !actor.unitId) {
      throw new ForbiddenException('Gestor sem unidade associada');
    }

    const now = new Date();
    const currentStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const previousStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const previousComparableEnd = new Date(
      Math.min(currentStart.getTime(), previousStart.getTime() + (now.getTime() - currentStart.getTime())),
    );
    const unitId = actor.role === 'MANAGER' ? actor.unitId! : undefined;
    const [analysis, sessions, unit] = await Promise.all([
      this.intelligence.manager(actor, { days: 90 }),
      this.prisma.chargingSession.findMany({
        where: {
          userId: { not: null },
          user: unitId ? { unitId } : { unitId: { not: null } },
          startedAt: { gte: previousStart, lt: now },
          endedAt: { not: null },
          status: { in: [SessionStatus.COMPLETED, SessionStatus.INTERRUPTED] },
          dataQuality: DataQuality.VALID,
        },
        select: {
          startedAt: true,
          status: true,
          energyKwh: true,
          observedEnergyKwh: true,
          calculatedEnergyKwh: true,
          user: { select: { unit: { select: { code: true } } } },
        },
      }),
      unitId
        ? this.prisma.unit.findUnique({ where: { id: unitId }, select: { code: true } })
        : Promise.resolve(null),
    ]);

    const current = sessions.filter(
      (session) => session.startedAt >= currentStart && session.startedAt < nextMonth,
    );
    const previous = sessions.filter(
      (session) =>
        session.startedAt >= previousStart && session.startedAt < previousComparableEnd,
    );
    const summarize = (items: typeof sessions) => ({
      energyKwh: this.round(
        items.reduce((sum, session) => sum + Number(this.validatedEnergy(session)), 0),
        3,
      ),
      sessions: items.length,
    });
    const currentSummary = summarize(current);
    const previousSummary = summarize(previous);
    const comparison = this.comparison(currentSummary.energyKwh, previousSummary.energyKwh);

    const unitTotals = new Map<string, { energyKwh: number; sessions: number }>();
    for (const session of current) {
      const code = session.user?.unit?.code;
      if (!code) continue;
      const aggregate = unitTotals.get(code) ?? { energyKwh: 0, sessions: 0 };
      aggregate.energyKwh += Number(this.validatedEnergy(session));
      aggregate.sessions += 1;
      unitTotals.set(code, aggregate);
    }
    const topUnit =
      actor.role === 'ADMIN'
        ? [...unitTotals.entries()]
            .map(([code, value]) => ({
              code,
              energyKwh: this.round(value.energyKwh, 3),
              sessions: value.sessions,
            }))
            .sort((a, b) => b.energyKwh - a.energyKwh || a.code.localeCompare(b.code))[0] ?? null
        : null;

    const peak = analysis.peakHours[0];
    const idle = [...analysis.chargerUtilization].sort(
      (a, b) => a.utilizationPercent - b.utilizationPercent,
    )[0];
    return {
      scope: {
        type: actor.role === 'ADMIN' ? 'ALL_UNITS' : 'UNIT',
        unitCode: unit?.code ?? null,
      },
      currentMonth: {
        reference: this.monthReference(currentStart),
        ...currentSummary,
      },
      previousComparablePeriod: {
        reference: this.monthReference(previousStart),
        ...previousSummary,
      },
      monthComparison: comparison,
      peakHour: peak
        ? {
            hour: peak.hour,
            sessions: peak.sessions,
            percentage: peak.percentage,
            sampleSize: peak.sampleSize,
          }
        : null,
      anomalySummary: {
        count: analysis.anomalies.length,
        energyOutliers: analysis.anomalies.filter((item) => item.type === 'ENERGY_OUTLIER').length,
        durationOutliers: analysis.anomalies.filter((item) => item.type === 'DURATION_OUTLIER').length,
        method: 'IQR',
        quality: analysis.analysisQuality.anomalyDetection.quality,
        sampleSize: analysis.sampleSize,
      },
      mostIdleCharger: idle
        ? {
            name: idle.chargerName,
            utilizationPercent: idle.utilizationPercent,
            idlePercent: this.round(100 - idle.utilizationPercent, 2),
            observedSessions: idle.sessionCount,
          }
        : null,
      topUnit,
    };
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

  private comparison(current: number, previous: number) {
    if (previous === 0) {
      return {
        direction: current === 0 ? ('STABLE' as const) : ('NO_BASELINE' as const),
        percentage: current === 0 ? 0 : null,
      };
    }
    const percentage = this.round(((current - previous) / previous) * 100, 1);
    return {
      direction:
        Math.abs(percentage) < 0.1
          ? ('STABLE' as const)
          : percentage > 0
            ? ('INCREASE' as const)
            : ('DECREASE' as const),
      percentage: Math.abs(percentage),
    };
  }

  private monthReference(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private round(value: number, decimals: number) {
    const factor = 10 ** decimals;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
}
