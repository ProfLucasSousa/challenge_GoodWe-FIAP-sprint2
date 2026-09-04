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
import { GoodWeSemsProvider } from './goodwe-sems.provider';
import { MockChargerProvider } from './mock-charger.provider';
import {
  ProviderCapabilityNotSupportedError,
  ProviderResourceNotFoundError,
} from './provider-errors';

@Injectable()
export class DemoHybridChargerProvider implements ChargerProvider {
  readonly name = 'demo' as const;
  private readonly realIds = new Set<string>();
  private readonly mockIds = new Set<string>();

  constructor(
    private readonly goodwe: GoodWeSemsProvider,
    private readonly mock: MockChargerProvider,
  ) {}

  async listChargers(): Promise<ExternalCharger[]> {
    const health = await this.safeGoodWeHealth();
    const real = health.capabilities.listChargers
      ? await this.safeReal(() => this.goodwe.listChargers(), [])
      : [];
    real.forEach((charger) => this.realIds.add(charger.externalId));

    const needsMockCoverage =
      real.length === 0 ||
      !health.capabilities.telemetry ||
      !health.capabilities.sessions ||
      !health.capabilities.events;
    const mock = needsMockCoverage ? await this.mock.listChargers() : [];
    mock.forEach((charger) => this.mockIds.add(charger.externalId));
    return [...real, ...mock];
  }

  async getChargerStatus(externalId: string) {
    return (await this.resolveOrigin(externalId)) === 'REAL'
      ? this.goodwe.getChargerStatus(externalId)
      : this.mock.getChargerStatus(externalId);
  }

  async getTelemetry(externalId: string): Promise<ChargerTelemetry> {
    return (await this.resolveOrigin(externalId)) === 'REAL'
      ? this.goodwe.getTelemetry(externalId)
      : this.mock.getTelemetry(externalId);
  }

  async getSessions(externalId: string, range: DateRange): Promise<ExternalChargingSession[]> {
    if ((await this.resolveOrigin(externalId)) === 'REAL') {
      if (!this.goodwe.getSessions) throw this.unsupported('sessions');
      return this.goodwe.getSessions(externalId, range);
    }
    return this.mock.getSessions!(externalId, range);
  }

  async getEvents(externalId: string, range: DateRange): Promise<ExternalChargerEvent[]> {
    if ((await this.resolveOrigin(externalId)) === 'REAL') {
      if (!this.goodwe.getEvents) throw this.unsupported('events');
      return this.goodwe.getEvents(externalId, range);
    }
    return this.mock.getEvents!(externalId, range);
  }

  async healthCheck(): Promise<ProviderHealth> {
    const [real, mock] = await Promise.all([this.safeGoodWeHealth(), this.mock.healthCheck()]);
    const realCapabilities = Object.values(real.capabilities).filter(Boolean).length;
    const capabilities: ProviderHealth['capabilities'] = { ...mock.capabilities };
    for (const key of Object.keys(capabilities) as Array<keyof typeof capabilities>) {
      capabilities[key] = real.capabilities[key] || mock.capabilities[key];
    }
    return {
      provider: this.name,
      status: real.status === 'available' ? 'available' : 'degraded',
      checkedAt: new Date(),
      message:
        realCapabilities > 0
          ? `Modo demo híbrido: ${realCapabilities} capabilities reais; lacunas cobertas por MOCK identificado.`
          : 'Modo demo offline: GoodWe indisponível; capabilities operacionais cobertas por MOCK identificado.',
      capabilities,
    };
  }

  private async resolveOrigin(externalId: string) {
    if (!this.realIds.has(externalId) && !this.mockIds.has(externalId)) await this.listChargers();
    if (this.realIds.has(externalId)) return 'REAL' as const;
    if (this.mockIds.has(externalId)) return 'MOCK' as const;
    throw new ProviderResourceNotFoundError('Carregador');
  }

  private async safeGoodWeHealth() {
    try {
      return await this.goodwe.healthCheck();
    } catch {
      return {
        provider: 'goodwe' as const,
        status: 'unavailable' as const,
        checkedAt: new Date(),
        message: 'GoodWe indisponível.',
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

  private async safeReal<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await operation();
    } catch {
      return fallback;
    }
  }

  private unsupported(capability: 'sessions' | 'events') {
    return new ProviderCapabilityNotSupportedError(
      capability,
      'goodwe',
      'a capability real não está disponível; MOCK não é atribuído a dispositivo real',
    );
  }
}
