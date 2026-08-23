import type { ChargerStatus } from '@ev-chargeops/shared';

export const CHARGER_PROVIDER = Symbol('CHARGER_PROVIDER');
export type DataOrigin = 'REAL' | 'MOCK' | 'CALCULATED';

export interface ExternalCharger {
  origin: DataOrigin;
  externalId: string;
  serialNumber: string;
  name: string;
  model: 'GW7K-HCA-20' | 'GW11K-HCA-20' | 'GW22K-HCA-20';
  nominalPowerKw: number;
  phaseType: 'SINGLE_PHASE' | 'THREE_PHASE';
  location: string;
}

export interface ChargerTelemetry {
  origin: DataOrigin;
  externalId: string;
  status: ChargerStatus;
  powerKw: number | null;
  currentA: number | null;
  voltageV: number | null;
  accumulatedEnergyKwh: number | null;
  observedAt: Date | null;
  alarmCode?: string;
  rawMetadata?: Record<string, unknown>;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface ExternalChargingSession {
  origin: DataOrigin;
  externalId: string;
  chargerExternalId: string;
  startedAt: Date;
  endedAt: Date | null;
  energyKwh: number;
  averagePowerKw: number | null;
  status: 'ACTIVE' | 'COMPLETED' | 'INTERRUPTED' | 'ERROR' | 'PENDING_REVIEW';
  rawMetadata?: Record<string, unknown>;
}

export interface ExternalChargerEvent {
  origin: DataOrigin;
  externalId?: string;
  chargerExternalId: string;
  occurredAt: Date;
  type: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  rawMetadata?: Record<string, unknown>;
}

export type ProviderCapability =
  | 'listChargers'
  | 'chargerStatus'
  | 'telemetry'
  | 'sessions'
  | 'events'
  | 'rfid'
  | 'alarms'
  | 'startSession'
  | 'remoteControl'
  | 'authentication';

export interface ProviderCapabilities {
  listChargers: boolean;
  chargerStatus: boolean;
  telemetry: boolean;
  sessions: boolean;
  events: boolean;
  rfid: boolean;
  alarms: boolean;
  startSession: boolean;
  remoteControl: boolean;
}

export interface ProviderHealth {
  provider: 'mock' | 'goodwe' | 'demo';
  status: 'available' | 'degraded' | 'unavailable';
  checkedAt: Date;
  message: string;
  capabilities: ProviderCapabilities;
}

export interface ChargerProvider {
  readonly name: 'mock' | 'goodwe' | 'demo';
  listChargers(): Promise<ExternalCharger[]>;
  getChargerStatus(externalId: string): Promise<ChargerStatus>;
  getTelemetry(externalId: string): Promise<ChargerTelemetry>;
  getSessions?(externalId: string, range: DateRange): Promise<ExternalChargingSession[]>;
  getEvents?(externalId: string, range: DateRange): Promise<ExternalChargerEvent[]>;
  healthCheck(): Promise<ProviderHealth>;
}
