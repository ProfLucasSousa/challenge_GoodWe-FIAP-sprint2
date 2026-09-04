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
import { GoodWeApiClient } from './goodwe-api.client';

/**
 * Boundary for the official SEMS integration.
 *
 * Intentionally performs no HTTP request until an authorized Open API account,
 * authentication flow, endpoints and response fields are documented and tested.
 */
@Injectable()
export class GoodWeSemsProvider implements ChargerProvider {
  readonly name = 'goodwe' as const;

  constructor(private readonly api: GoodWeApiClient) {}

  async listChargers(): Promise<ExternalCharger[]> {
    return this.api.unsupported('listChargers');
  }

  async getChargerStatus(_externalId: string) {
    return this.api.unsupported('chargerStatus');
  }

  async getTelemetry(_externalId: string): Promise<ChargerTelemetry> {
    return this.api.unsupported('telemetry');
  }

  async getSessions(_externalId: string, _range: DateRange): Promise<ExternalChargingSession[]> {
    return this.api.unsupported('sessions');
  }

  async getEvents(_externalId: string, _range: DateRange): Promise<ExternalChargerEvent[]> {
    return this.api.unsupported('events');
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: this.name,
      status: 'unavailable',
      checkedAt: new Date(),
      message: 'Contrato OpenAPI do HCA G2 não confirmado; nenhuma chamada externa foi realizada.',
      capabilities: {
        listChargers: false,
        chargerStatus: false,
        telemetry: false,
        sessions: false,
        events: false,
        rfid: false,
        alarms: false,
        startSession: false,
        remoteControl: false,
      },
    };
  }
}
