import { Injectable } from '@nestjs/common';
import type {
  ChargerProvider,
  ChargerTelemetry,
  DateRange,
  ExternalCharger,
  ExternalChargerEvent,
  ExternalChargingSession,
  ProviderHealth,
} from './charger-provider';
import { ProviderResourceNotFoundError } from './provider-errors';

const chargers: ExternalCharger[] = [
  {
    origin: 'MOCK',
    externalId: 'mock-hca-01',
    serialNumber: 'MOCK-HCA-G2-0001',
    name: 'Vaga 01',
    model: 'GW22K-HCA-20',
    nominalPowerKw: 22,
    phaseType: 'THREE_PHASE',
    location: 'Garagem · Piso G1',
  },
  {
    origin: 'MOCK',
    externalId: 'mock-hca-02',
    serialNumber: 'MOCK-HCA-G2-0002',
    name: 'Vaga 02',
    model: 'GW11K-HCA-20',
    nominalPowerKw: 11,
    phaseType: 'THREE_PHASE',
    location: 'Garagem · Piso G1',
  },
  {
    origin: 'MOCK',
    externalId: 'mock-hca-03',
    serialNumber: 'MOCK-HCA-G2-0003',
    name: 'Vaga 03',
    model: 'GW7K-HCA-20',
    nominalPowerKw: 7,
    phaseType: 'SINGLE_PHASE',
    location: 'Garagem · Piso G2',
  },
];

const sessions: ExternalChargingSession[] = [
  {
    origin: 'MOCK',
    externalId: 'mock-session-01',
    chargerExternalId: 'mock-hca-01',
    startedAt: new Date('2026-10-10T18:20:00.000Z'),
    endedAt: new Date('2026-10-10T20:52:00.000Z'),
    energyKwh: 18.75,
    averagePowerKw: 7.4,
    status: 'COMPLETED',
  },
  {
    origin: 'MOCK',
    externalId: 'mock-session-02',
    chargerExternalId: 'mock-hca-02',
    startedAt: new Date('2026-10-11T07:10:00.000Z'),
    endedAt: new Date('2026-10-11T08:55:00.000Z'),
    energyKwh: 14.2,
    averagePowerKw: 8.1,
    status: 'COMPLETED',
  },
];

const events: ExternalChargerEvent[] = [
  {
    origin: 'MOCK',
    externalId: 'mock-event-01',
    chargerExternalId: 'mock-hca-03',
    occurredAt: new Date('2026-10-11T11:15:00.000Z'),
    type: 'CHARGER_OFFLINE',
    severity: 'WARNING',
    message: 'Carregador mock sem comunicação.',
  },
];

@Injectable()
export class MockChargerProvider implements ChargerProvider {
  readonly name = 'mock' as const;

  async listChargers(): Promise<ExternalCharger[]> {
    return chargers.map((charger) => ({ ...charger }));
  }

  async getChargerStatus(externalId: string) {
    return (await this.getTelemetry(externalId)).status;
  }

  async getTelemetry(externalId: string): Promise<ChargerTelemetry> {
    this.assertChargerExists(externalId);
    const now = new Date();
    const telemetry: Record<string, Omit<ChargerTelemetry, 'externalId' | 'observedAt'>> = {
      'mock-hca-01': {
        origin: 'MOCK',
        status: 'CHARGING',
        powerKw: 10.8,
        currentA: 15.7,
        voltageV: 230.1,
        accumulatedEnergyKwh: 18.4,
      },
      'mock-hca-02': {
        origin: 'MOCK',
        status: 'AVAILABLE',
        powerKw: 0,
        currentA: 0,
        voltageV: 229.8,
        accumulatedEnergyKwh: null,
      },
      'mock-hca-03': {
        origin: 'MOCK',
        status: 'OFFLINE',
        powerKw: null,
        currentA: null,
        voltageV: null,
        accumulatedEnergyKwh: null,
      },
    };
    return { externalId, ...telemetry[externalId]!, observedAt: now };
  }

  async getSessions(externalId: string, range: DateRange): Promise<ExternalChargingSession[]> {
    this.assertChargerExists(externalId);
    if (range.from > range.to) {
      return [];
    }
    return sessions
      .filter(
        (session) =>
          session.chargerExternalId === externalId &&
          session.startedAt >= range.from &&
          session.startedAt <= range.to,
      )
      .map((session) => ({ ...session }));
  }

  async getEvents(externalId: string, range: DateRange): Promise<ExternalChargerEvent[]> {
    this.assertChargerExists(externalId);
    return events
      .filter(
        (event) =>
          event.chargerExternalId === externalId &&
          event.occurredAt >= range.from &&
          event.occurredAt <= range.to,
      )
      .map((event) => ({ ...event }));
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: this.name,
      status: 'available',
      checkedAt: new Date(),
      message: 'Provider mock operacional.',
      capabilities: {
        listChargers: true,
        chargerStatus: true,
        telemetry: true,
        sessions: true,
        events: true,
        rfid: false,
        alarms: true,
        startSession: true,
        remoteControl: false,
      },
    };
  }

  private assertChargerExists(externalId: string) {
    if (!chargers.some((charger) => charger.externalId === externalId)) {
      throw new ProviderResourceNotFoundError('Carregador');
    }
  }
}
