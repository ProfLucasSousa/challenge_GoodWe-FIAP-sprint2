import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ChargerProvider as ChargerProviderEnum,
  ChargerStatus,
  IntegrationStatus,
  ReadingSource,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CHARGER_PROVIDER, type ChargerProvider } from './charger-provider';
import {
  ChargerProviderError,
  ProviderCapabilityNotSupportedError,
  ProviderPayloadInvalidError,
} from './provider-errors';

@Injectable()
export class ChargersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CHARGER_PROVIDER) private readonly provider: ChargerProvider,
  ) {}

  async list() {
    const chargers = await this.prisma.charger.findMany({ orderBy: { name: 'asc' } });
    return chargers.map((charger) => ({
      ...charger,
      origin:
        charger.provider === ChargerProviderEnum.GOODWE ? ('REAL' as const) : ('MOCK' as const),
    }));
  }

  async operational(id: string) {
    const charger = await this.prisma.charger.findUnique({
      where: { id },
      include: {
        readings: { orderBy: { timestamp: 'desc' }, take: 96 },
        sessions: {
          where: { status: 'ACTIVE' },
          orderBy: { startedAt: 'desc' },
          take: 1,
          select: {
            energyKwh: true,
            observedEnergyKwh: true,
            calculatedEnergyKwh: true,
            source: true,
            updatedAt: true,
          },
        },
      },
    });
    if (!charger) throw new NotFoundException('Carregador não encontrado');

    const latest = charger.readings[0];
    const activeSession = charger.sessions[0];
    const configuredSource = charger.provider === ChargerProviderEnum.GOODWE ? 'SEMS' : 'MOCK';
    const configuredClassification =
      charger.provider === ChargerProviderEnum.GOODWE ? 'REAL' : 'MOCK';
    const readingSource = latest?.source ?? null;
    const readingClassification = readingSource
      ? readingSource === ReadingSource.MOCK
        ? 'MOCK'
        : 'REAL'
      : 'UNAVAILABLE';
    const observedAt = latest?.externalTimestamp ?? latest?.timestamp ?? null;
    const metric = <T>(value: T | null | undefined) => ({
      value: value ?? null,
      classification: value == null ? ('UNAVAILABLE' as const) : readingClassification,
      source: value == null ? null : readingSource,
      observedAt: value == null ? null : observedAt,
    });

    const sessionEnergy = activeSession
      ? activeSession.observedEnergyKwh != null
        ? {
            value: activeSession.observedEnergyKwh,
            classification: activeSession.source === 'MOCK' ? ('MOCK' as const) : ('REAL' as const),
            source: activeSession.source,
            observedAt: activeSession.updatedAt,
          }
        : activeSession.calculatedEnergyKwh != null
          ? {
              value: activeSession.calculatedEnergyKwh,
              classification: 'CALCULATED' as const,
              source: 'EV_CHARGEOPS' as const,
              observedAt: activeSession.updatedAt,
            }
          : {
              value: activeSession.energyKwh,
              classification:
                activeSession.source === 'MOCK' ? ('MOCK' as const) : ('REAL' as const),
              source: activeSession.source,
              observedAt: activeSession.updatedAt,
            }
      : { value: null, classification: 'UNAVAILABLE' as const, source: null, observedAt: null };

    return {
      id: charger.id,
      name: charger.name,
      location: charger.location,
      provider: charger.provider,
      origin: configuredClassification,
      metrics: {
        status:
          charger.status === ChargerStatus.UNKNOWN || !charger.lastSeenAt
            ? {
                value: null,
                classification: 'UNAVAILABLE' as const,
                source: null,
                observedAt: null,
              }
            : {
                value: charger.status,
                classification: configuredClassification,
                source: configuredSource,
                observedAt: charger.lastSeenAt,
              },
        model: {
          value: charger.model,
          classification: configuredClassification,
          source: configuredSource,
          observedAt: charger.updatedAt,
        },
        nominalPowerKw: {
          value: charger.nominalPowerKw,
          classification: configuredClassification,
          source: configuredSource,
          observedAt: charger.updatedAt,
        },
        powerKw: metric(latest?.powerKw),
        sessionEnergyKwh: sessionEnergy,
        accumulatedEnergyKwh: metric(latest?.accumulatedEnergyKwh),
        currentA: metric(latest?.currentA),
        voltageV: metric(latest?.voltageV),
        lastUpdatedAt: {
          value: observedAt,
          classification: observedAt ? readingClassification : ('UNAVAILABLE' as const),
          source: observedAt ? readingSource : null,
          observedAt,
        },
      },
      readings: [...charger.readings].reverse().map((reading) => ({
        timestamp: reading.externalTimestamp ?? reading.timestamp,
        powerKw: reading.powerKw,
        currentA: reading.currentA,
        voltageV: reading.voltageV,
        accumulatedEnergyKwh: reading.accumulatedEnergyKwh,
        classification: reading.source === ReadingSource.MOCK ? 'MOCK' : 'REAL',
        source: reading.source,
      })),
    };
  }

  async providerHealth() {
    const syncProvider =
      this.provider.name === 'goodwe' ? ChargerProviderEnum.GOODWE : ChargerProviderEnum.MOCK;
    const [health, lastSync, lastSuccessfulSync, identifiedChargers] = await Promise.all([
      this.provider.healthCheck(),
      this.prisma.integrationSync.findFirst({
        where: { provider: syncProvider },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.integrationSync.findFirst({
        where: { provider: syncProvider, status: IntegrationStatus.SUCCESS },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
      this.prisma.charger.count({
        where:
          this.provider.name === 'goodwe' ? { provider: ChargerProviderEnum.GOODWE } : undefined,
      }),
    ]);
    return {
      ...health,
      connected: health.status === 'available',
      readOnly: true,
      identifiedChargers,
      lastSync: lastSync?.finishedAt ?? lastSync?.startedAt ?? null,
      lastSuccessfulSync: lastSuccessfulSync?.finishedAt ?? null,
      lastError:
        lastSync?.status === IntegrationStatus.FAILED && lastSync.errorMessage
          ? this.sanitizeError(lastSync.errorMessage)
          : null,
    };
  }

  async sync() {
    const startedAt = new Date();
    const syncProvider =
      this.provider.name === 'goodwe' ? ChargerProviderEnum.GOODWE : ChargerProviderEnum.MOCK;

    try {
      const externalChargers = await this.provider.listChargers();
      const snapshots = await Promise.all(
        externalChargers.map(async (charger) => {
          try {
            const telemetry = await this.provider.getTelemetry(charger.externalId);
            if (charger.origin !== telemetry.origin) throw new ProviderPayloadInvalidError();
            return { ...charger, ...telemetry };
          } catch (error) {
            if (!(error instanceof ProviderCapabilityNotSupportedError)) throw error;
            return {
              ...charger,
              status: 'UNKNOWN' as const,
              powerKw: null,
              currentA: null,
              voltageV: null,
              accumulatedEnergyKwh: null,
              observedAt: null,
              telemetryUnavailable: true as const,
            };
          }
        }),
      );
      const existing = await this.prisma.charger.findMany({
        where: { serialNumber: { in: snapshots.map((snapshot) => snapshot.serialNumber) } },
        select: { serialNumber: true },
      });
      const existingSerials = new Set(existing.map((charger) => charger.serialNumber));

      const persistedChargers = await this.prisma.$transaction(
        snapshots.map((snapshot) => {
          const status = snapshot.status as ChargerStatus;
          const recordProvider =
            snapshot.origin === 'REAL' ? ChargerProviderEnum.GOODWE : ChargerProviderEnum.MOCK;
          return this.prisma.charger.upsert({
            where: { serialNumber: snapshot.serialNumber },
            create: {
              externalId: snapshot.externalId,
              serialNumber: snapshot.serialNumber,
              name: snapshot.name,
              model: snapshot.model,
              nominalPowerKw: snapshot.nominalPowerKw,
              phaseType: snapshot.phaseType,
              location: snapshot.location,
              status,
              provider: recordProvider,
              lastSeenAt: snapshot.observedAt,
            },
            update: {
              externalId: snapshot.externalId,
              status,
              provider: recordProvider,
              ...(snapshot.observedAt ? { lastSeenAt: snapshot.observedAt } : {}),
            },
          });
        }),
      );
      await this.prisma.$transaction(
        snapshots.flatMap((snapshot, index) => {
          if (!snapshot.observedAt) return [];
          const charger = persistedChargers[index]!;
          const status = snapshot.status as ChargerStatus;
          const readingSource =
            snapshot.origin === 'REAL' ? ReadingSource.SEMS : ReadingSource.MOCK;
          const data = {
            externalTimestamp: snapshot.observedAt,
            timestamp: snapshot.observedAt,
            powerKw: snapshot.powerKw,
            currentA: snapshot.currentA,
            voltageV: snapshot.voltageV,
            accumulatedEnergyKwh: snapshot.accumulatedEnergyKwh,
            source: readingSource,
            rawMetadata: {
              origin: snapshot.origin,
              source: readingSource,
              status,
              ...(snapshot.alarmCode ? { alarmCode: snapshot.alarmCode } : {}),
            },
          };
          return [
            this.prisma.chargingReading.upsert({
              where: {
                chargerId_source_externalTimestamp: {
                  chargerId: charger.id,
                  source: readingSource,
                  externalTimestamp: snapshot.observedAt,
                },
              },
              create: { ...data, chargerId: charger.id },
              update: data,
            }),
          ];
        }),
      );
      await this.prisma.integrationSync.create({
        data: {
          provider: syncProvider,
          resourceType: 'chargers',
          startedAt,
          status: snapshots.some((snapshot) => !snapshot.observedAt)
            ? IntegrationStatus.PARTIAL
            : IntegrationStatus.SUCCESS,
          finishedAt: new Date(),
          recordsReceived: snapshots.length,
          recordsCreated: snapshots.filter(
            (snapshot) => !existingSerials.has(snapshot.serialNumber),
          ).length,
          recordsUpdated: snapshots.filter((snapshot) => existingSerials.has(snapshot.serialNumber))
            .length,
          metadata: {
            mode: this.provider.name,
            origins: {
              REAL: snapshots.filter((snapshot) => snapshot.origin === 'REAL').length,
              MOCK: snapshots.filter((snapshot) => snapshot.origin === 'MOCK').length,
              CALCULATED: snapshots.filter((snapshot) => snapshot.origin === 'CALCULATED').length,
            },
            telemetryUnavailable: snapshots.filter((snapshot) => !snapshot.observedAt).length,
          },
        },
      });
      return { provider: this.provider.name, synchronized: snapshots.length };
    } catch (error) {
      const providerError = error instanceof ChargerProviderError ? error : undefined;
      await this.prisma.integrationSync.create({
        data: {
          provider: syncProvider,
          resourceType: 'chargers',
          startedAt,
          status: IntegrationStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: providerError?.message ?? 'Falha não detalhada durante a sincronização.',
          metadata: {
            code:
              providerError?.code ??
              (this.provider.name === 'goodwe' ? 'GOODWE_CONTRACT_NOT_VALIDATED' : 'SYNC_FAILED'),
          },
        },
      });
      throw error;
    }
  }

  private sanitizeError(message: string) {
    return message
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[REDACTED_EMAIL]')
      .replace(/(bearer|token|cookie|password|senha)\s*[:=]?\s*[^\s,;]+/gi, '$1=[REDACTED]')
      .slice(0, 500);
  }
}
