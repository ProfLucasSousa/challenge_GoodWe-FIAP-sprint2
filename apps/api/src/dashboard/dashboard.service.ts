import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ChargerStatus, DataQuality, SessionSource, SessionStatus } from '@prisma/client';
import type { DashboardSummary, SessionStatus as SharedSessionStatus } from '@ev-chargeops/shared';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser, requestedMonth?: string): Promise<DashboardSummary> {
    if (user.role === 'MANAGER' && !user.unitId) {
      throw new ForbiddenException('Gestor sem unidade associada');
    }
    const month = requestedMonth ?? new Date().toISOString().slice(0, 7);
    const { start, end } = this.monthRange(month);
    const historyStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 5, 1));
    const accessFilter =
      user.role === 'USER'
        ? { userId: user.sub }
        : user.role === 'MANAGER' && user.unitId
          ? { user: { unitId: user.unitId } }
          : {};

    const [sessions, historicalSessions, chargers, activeVehicles] = await Promise.all([
      this.prisma.chargingSession.findMany({
        where: { ...accessFilter, startedAt: { gte: start, lt: end } },
        include: {
          user: { select: { name: true, unit: { select: { code: true } } } },
          charger: { select: { name: true } },
          invoiceItem: { select: { amount: true } },
        },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.chargingSession.findMany({
        where: { ...accessFilter, startedAt: { gte: historyStart, lt: end } },
        select: {
          startedAt: true,
          energyKwh: true,
          observedEnergyKwh: true,
          calculatedEnergyKwh: true,
          dataQuality: true,
        },
      }),
      this.prisma.charger.findMany({ select: { id: true, name: true, status: true } }),
      user.role === 'USER'
        ? this.prisma.vehicle.count({ where: { ownerId: user.sub, active: true } })
        : Promise.resolve(0),
    ]);

    const daily = new Map<string, number>();
    const hourly = new Map<number, number>();
    const byCharger = new Map<string, number>();
    const byUnit = new Map<string, number>();
    let durationTotal = 0;
    let durationCount = 0;
    for (const session of sessions) {
      const key = session.startedAt.toISOString().slice(0, 10);
      const validEnergy =
        session.dataQuality === DataQuality.VALID
          ? Number(session.observedEnergyKwh ?? session.calculatedEnergyKwh ?? session.energyKwh)
          : 0;
      daily.set(key, (daily.get(key) ?? 0) + validEnergy);
      byCharger.set(
        session.chargerId,
        (byCharger.get(session.chargerId) ?? 0) + this.occupiedMinutes(session, start, end),
      );
      const unitCode = session.user?.unit?.code;
      if (unitCode) byUnit.set(unitCode, (byUnit.get(unitCode) ?? 0) + validEnergy);
      const hour = session.startedAt.getHours();
      hourly.set(hour, (hourly.get(hour) ?? 0) + 1);
      if (session.endedAt) {
        durationTotal += (session.endedAt.getTime() - session.startedAt.getTime()) / 60_000;
        durationCount += 1;
      }
    }

    const monthly = new Map<string, number>();
    for (const session of historicalSessions) {
      const key = session.startedAt.toISOString().slice(0, 7);
      const energy =
        session.dataQuality === DataQuality.VALID
          ? Number(session.observedEnergyKwh ?? session.calculatedEnergyKwh ?? session.energyKwh)
          : 0;
      monthly.set(key, (monthly.get(key) ?? 0) + energy);
    }
    const effectiveEnd = new Date(Math.min(end.getTime(), Date.now()));
    const windowMinutes = Math.max(1, (effectiveEnd.getTime() - start.getTime()) / 60_000);

    return {
      origin: 'CALCULATED',
      inputOrigins: [
        ...new Set(
          sessions.map((session) =>
            session.source === SessionSource.MOCK ? ('MOCK' as const) : ('REAL' as const),
          ),
        ),
      ],
      period: month,
      energyKwh: this.round(
        sessions.reduce(
          (sum, item) =>
            sum +
            (item.dataQuality === DataQuality.VALID
              ? Number(item.observedEnergyKwh ?? item.calculatedEnergyKwh ?? item.energyKwh)
              : 0),
          0,
        ),
      ),
      totalAmount: this.round(
        sessions.reduce((sum, item) => sum + Number(item.invoiceItem?.amount ?? 0), 0),
      ),
      sessions: sessions.length,
      averageDurationMinutes: durationCount ? Math.round(durationTotal / durationCount) : 0,
      availableChargers: chargers.filter((item) => item.status === ChargerStatus.AVAILABLE).length,
      chargingChargers: chargers.filter((item) => item.status === ChargerStatus.CHARGING).length,
      offlineOrFaultChargers: chargers.filter(
        (item) => item.status === ChargerStatus.OFFLINE || item.status === ChargerStatus.FAULT,
      ).length,
      totalChargers: chargers.length,
      pendingSessions: sessions.filter((item) => item.status === SessionStatus.PENDING_REVIEW)
        .length,
      activeVehicles,
      peakHours: [...hourly.entries()]
        .sort(([a], [b]) => a - b)
        .map(([hour, count]) => ({ hour: `${String(hour).padStart(2, '0')}:00`, sessions: count })),
      dailyEnergy: [...daily.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, energyKwh]) => ({ day, energyKwh: this.round(energyKwh) })),
      monthlyEnergy: [...monthly.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([historicalMonth, energyKwh]) => ({
          month: historicalMonth,
          energyKwh: this.round(energyKwh),
        })),
      chargerUtilization: chargers.map((charger) => {
        const utilizationPercent = this.round(
          ((byCharger.get(charger.id) ?? 0) / windowMinutes) * 100,
        );
        return {
          chargerId: charger.id,
          chargerName: charger.name,
          utilizationPercent,
          idlePercent: this.round(100 - utilizationPercent),
        };
      }),
      energyByUnit: [...byUnit.entries()]
        .map(([unitCode, energyKwh]) => ({ unitCode, energyKwh: this.round(energyKwh) }))
        .sort((a, b) => b.energyKwh - a.energyKwh),
      recentSessions: sessions.slice(0, 6).map((session) => ({
        origin: session.source === SessionSource.MOCK ? ('MOCK' as const) : ('REAL' as const),
        id: session.id,
        userName: session.user?.name ?? 'Usuário não identificado',
        unitCode: session.user?.unit?.code ?? 'Sem unidade',
        chargerName: session.charger.name,
        startedAt: session.startedAt.toISOString(),
        energyKwh: Number(
          session.observedEnergyKwh ?? session.calculatedEnergyKwh ?? session.energyKwh,
        ),
        amount: session.invoiceItem ? Number(session.invoiceItem.amount) : null,
        status: session.status as SharedSessionStatus,
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

  private round(value: number) {
    return Math.round(value * 100) / 100;
  }

  private occupiedMinutes(
    session: { startedAt: Date; endedAt: Date | null },
    start: Date,
    end: Date,
  ) {
    const from = Math.max(start.getTime(), session.startedAt.getTime());
    const to = Math.min(end.getTime(), session.endedAt?.getTime() ?? Date.now());
    return Math.max(0, (to - from) / 60_000);
  }
}
