import type { DashboardSummary, HealthResponse } from '@ev-chargeops/shared';

export interface AuthSession {
  accessToken: string;
  user: { id: string; name: string; email: string; role: string; unitId: string | null };
}

export interface ChargerView {
  id: string;
  name: string;
  model: string;
  nominalPowerKw: number | string;
  location: string;
  status: 'AVAILABLE' | 'CHARGING' | 'OFFLINE' | 'FAULT' | 'UNKNOWN';
  provider?: 'MOCK' | 'GOODWE';
  origin?: 'REAL' | 'MOCK';
  lastSeenAt: string | null;
}

export type MetricClassification = 'REAL' | 'MOCK' | 'CALCULATED' | 'UNAVAILABLE';
export interface OperationalMetric<T> {
  value: T | null;
  classification: MetricClassification;
  source: string | null;
  observedAt: string | null;
}
export interface ChargerOperationalView {
  id: string;
  name: string;
  location: string;
  provider: 'MOCK' | 'GOODWE';
  metrics: {
    status: OperationalMetric<string>;
    model: OperationalMetric<string>;
    nominalPowerKw: OperationalMetric<number | string>;
    powerKw: OperationalMetric<number | string>;
    sessionEnergyKwh: OperationalMetric<number | string>;
    accumulatedEnergyKwh: OperationalMetric<number | string>;
    currentA: OperationalMetric<number | string>;
    voltageV: OperationalMetric<number | string>;
    lastUpdatedAt: OperationalMetric<string>;
  };
  readings: Array<{
    timestamp: string;
    powerKw: number | string | null;
    currentA: number | string | null;
    voltageV: number | string | null;
    accumulatedEnergyKwh: number | string | null;
    classification: Exclude<MetricClassification, 'CALCULATED' | 'UNAVAILABLE'>;
    source: string;
  }>;
}

export interface AssistantResponse {
  answer: string;
  sources: Array<{ metric: string; value: string }>;
}

export interface ProviderStatusResponse {
  provider: 'mock' | 'goodwe' | 'demo';
  status: 'available' | 'degraded' | 'unavailable';
  connected: boolean;
  readOnly: true;
  message: string;
  checkedAt: string;
  capabilities: Record<string, boolean>;
  identifiedChargers: number;
  lastSync: string | null;
  lastSuccessfulSync: string | null;
  lastError: string | null;
}

export interface IntelligenceView {
  sampleSize: number;
  peakHours: Array<{
    hour: string;
    sessions: number;
    percentage: number;
    method: string;
    sampleSize: number;
    humanReadableExplanation: string;
  }>;
  lowestUsageHours: Array<{ hour: string; sessions: number }>;
  averageSessionEnergy: number | null;
  averageSessionDuration: number | null;
  chargerUtilization: Array<{
    chargerName: string;
    utilizationPercent: number;
    sessionCount: number;
  }>;
  anomalies: Array<{ message: string; method: string; sampleSize: number }>;
  demandForecast: {
    quality: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
    predictions: Array<{ predictedEnergyKwh: number; predictedSessions: number }>;
    humanReadableExplanation: string;
  };
}

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? 'Não foi possível concluir a solicitação');
  }
  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>('/health'),
  login: (email: string, password: string) =>
    request<AuthSession>('/auth/login', undefined, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  dashboard(token: string, month: string) {
    if (token === 'demo') return Promise.resolve(demoDashboard(month));
    return request<DashboardSummary>(
      `/dashboard/summary?month=${encodeURIComponent(month)}`,
      token,
    );
  },
  chargers(token: string) {
    if (token === 'demo') return Promise.resolve(demoChargers);
    return request<ChargerView[]>('/chargers', token);
  },
  operationalCharger(token: string, id: string) {
    if (token === 'demo') return Promise.resolve(demoOperationalCharger(id));
    return request<ChargerOperationalView>(
      `/chargers/${encodeURIComponent(id)}/operational`,
      token,
    );
  },
  assistant(token: string, question: string) {
    if (token === 'demo') return Promise.resolve(demoAssistant(question));
    return request<AssistantResponse>('/assistant/query', token, {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  },
  providerStatus(token: string) {
    if (token === 'demo') return Promise.resolve(demoProviderStatus());
    return request<ProviderStatusResponse>('/chargers/provider/health', token);
  },
  syncChargers(token: string) {
    if (token === 'demo') return Promise.resolve({ provider: 'demo', synchronized: 3 });
    return request<{ provider: string; synchronized: number }>('/chargers/sync', token, {
      method: 'POST',
    });
  },
  intelligence(token: string) {
    if (token === 'demo') return Promise.resolve(demoIntelligence());
    return request<IntelligenceView>('/intelligence/manager?days=90', token);
  },
};

function demoProviderStatus(): ProviderStatusResponse {
  return {
    provider: 'demo',
    status: 'degraded',
    connected: false,
    readOnly: true,
    message: 'Modo demo offline: GoodWe indisponível; dados MOCK permanecem identificados.',
    checkedAt: new Date().toISOString(),
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
    identifiedChargers: 3,
    lastSync: null,
    lastSuccessfulSync: null,
    lastError: null,
  };
}

function demoIntelligence(): IntelligenceView {
  return {
    sampleSize: 36,
    peakHours: [
      {
        hour: '18:00',
        sessions: 9,
        percentage: 25,
        method: 'historical_frequency',
        sampleSize: 36,
        humanReadableExplanation: '25% das sessões começaram entre 18h e 19h.',
      },
    ],
    lowestUsageHours: [{ hour: '03:00', sessions: 0 }],
    averageSessionEnergy: 18.4,
    averageSessionDuration: 126,
    chargerUtilization: [{ chargerName: 'Vaga 03', utilizationPercent: 21, sessionCount: 8 }],
    anomalies: [
      {
        message: 'Uma sessão está fora da faixa histórica de energia.',
        method: 'IQR',
        sampleSize: 36,
      },
    ],
    demandForecast: {
      quality: 'MEDIUM',
      predictions: [{ predictedEnergyKwh: 214, predictedSessions: 10 }],
      humanReadableExplanation: 'Média móvel das últimas quatro semanas observadas.',
    },
  };
}

function demoOperationalCharger(id: string): ChargerOperationalView {
  const demo = demoChargers.find((charger) => charger.id === id) ?? demoChargers[0]!;
  const charging = demo.status === 'CHARGING';
  const observedAt = new Date().toISOString();
  const unavailable = <T>(): OperationalMetric<T> => ({
    value: null,
    classification: 'UNAVAILABLE',
    source: null,
    observedAt: null,
  });
  const mock = <T>(value: T): OperationalMetric<T> => ({
    value,
    classification: 'MOCK',
    source: 'MOCK',
    observedAt,
  });
  const readings = charging
    ? Array.from({ length: 12 }, (_, index) => ({
        timestamp: new Date(Date.now() - (11 - index) * 5 * 60_000).toISOString(),
        powerKw: 7.8 + ((index * 7) % 25) / 10,
        currentA: 12.1 + ((index * 3) % 8) / 10,
        voltageV: 229 + ((index * 2) % 7) / 10,
        accumulatedEnergyKwh: 12.4 + index * 0.8,
        classification: 'MOCK' as const,
        source: 'MOCK',
      }))
    : [];
  return {
    id: demo.id,
    name: demo.name,
    location: demo.location,
    provider: 'MOCK',
    metrics: {
      status: mock(demo.status),
      model: mock(demo.model),
      nominalPowerKw: mock(demo.nominalPowerKw),
      powerKw: charging ? mock(10.8) : unavailable(),
      sessionEnergyKwh: charging ? mock(18.4) : unavailable(),
      accumulatedEnergyKwh: charging ? mock(18.4) : unavailable(),
      currentA: charging ? mock(15.7) : unavailable(),
      voltageV: demo.status === 'OFFLINE' ? unavailable() : mock(230.1),
      lastUpdatedAt: mock(observedAt),
    },
    readings,
  };
}

function demoAssistant(question: string): AssistantResponse {
  const normalized = question.toLocaleLowerCase('pt-BR');
  if (normalized.includes('horário') || normalized.includes('demanda')) {
    return {
      answer:
        'O maior pico observado ocorre entre 18h e 21h, concentrando 38% das sessões analisadas.',
      sources: [
        { metric: 'peak_hour', value: '18h–21h' },
        { metric: 'peak_hour_percentage', value: '38%' },
      ],
    };
  }
  if (normalized.includes('ocioso')) {
    return {
      answer:
        'A Vaga 03 apresenta a menor utilização: 21% de uso e 79% de ociosidade na janela observada.',
      sources: [
        { metric: 'charger_name', value: 'Vaga 03' },
        { metric: 'charger_idle', value: '79%' },
      ],
    };
  }
  return {
    answer:
      'Com os dados agregados disponíveis, o consumo atual é de 842,6 kWh em 38 sessões válidas.',
    sources: [
      { metric: 'current_month_energy_kwh', value: '842,6 kWh' },
      { metric: 'current_month_sessions', value: '38' },
    ],
  };
}

const demoChargers: ChargerView[] = [
  {
    id: '1',
    name: 'Vaga 01',
    model: 'GW22K-HCA-20',
    nominalPowerKw: 22,
    location: 'Garagem · Piso G1',
    status: 'CHARGING',
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Vaga 02',
    model: 'GW11K-HCA-20',
    nominalPowerKw: 11,
    location: 'Garagem · Piso G1',
    status: 'AVAILABLE',
    lastSeenAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Vaga 03',
    model: 'GW7K-HCA-20',
    nominalPowerKw: 7,
    location: 'Garagem · Piso G2',
    status: 'OFFLINE',
    lastSeenAt: new Date(Date.now() - 1000 * 60 * 48).toISOString(),
  },
];

function demoDashboard(month: string): DashboardSummary {
  return {
    origin: 'CALCULATED',
    inputOrigins: ['MOCK'],
    period: month,
    energyKwh: 842.6,
    totalAmount: 911.28,
    sessions: 38,
    averageDurationMinutes: 126,
    availableChargers: 1,
    chargingChargers: 1,
    offlineOrFaultChargers: 1,
    totalChargers: 3,
    pendingSessions: 1,
    activeVehicles: 2,
    dailyEnergy: [
      { day: `${month}-01`, energyKwh: 74 },
      { day: `${month}-02`, energyKwh: 92 },
      { day: `${month}-03`, energyKwh: 68 },
      { day: `${month}-04`, energyKwh: 116 },
      { day: `${month}-05`, energyKwh: 84 },
      { day: `${month}-06`, energyKwh: 132 },
      { day: `${month}-07`, energyKwh: 104 },
      { day: `${month}-08`, energyKwh: 172.6 },
    ],
    peakHours: [
      { hour: '06:00', sessions: 3 },
      { hour: '09:00', sessions: 2 },
      { hour: '12:00', sessions: 4 },
      { hour: '15:00', sessions: 3 },
      { hour: '18:00', sessions: 9 },
      { hour: '21:00', sessions: 7 },
    ],
    monthlyEnergy: [
      { month: '2026-08', energyKwh: 614.2 },
      { month: '2026-09', energyKwh: 731.5 },
      { month, energyKwh: 842.6 },
    ],
    chargerUtilization: [
      { chargerId: '1', chargerName: 'Vaga 01', utilizationPercent: 78, idlePercent: 22 },
      { chargerId: '2', chargerName: 'Vaga 02', utilizationPercent: 54, idlePercent: 46 },
      { chargerId: '3', chargerName: 'Vaga 03', utilizationPercent: 21, idlePercent: 79 },
    ],
    energyByUnit: [
      { unitCode: 'DEMO-A-101', energyKwh: 126.8 },
      { unitCode: 'DEMO-B-202', energyKwh: 98.4 },
      { unitCode: 'DEMO-C-303', energyKwh: 87.2 },
    ],
    recentSessions: [
      {
        origin: 'MOCK',
        id: 's1',
        userName: 'Ana Souza',
        unitCode: 'Torre A · 1204',
        chargerName: 'Vaga 01',
        startedAt: `${month}-10T18:20:00.000Z`,
        energyKwh: 18.75,
        amount: 21.31,
        status: 'COMPLETED',
      },
      {
        origin: 'MOCK',
        id: 's2',
        userName: 'Rafael Lima',
        unitCode: 'Torre B · 804',
        chargerName: 'Vaga 02',
        startedAt: `${month}-09T07:10:00.000Z`,
        energyKwh: 14.2,
        amount: 16.63,
        status: 'COMPLETED',
      },
      {
        origin: 'MOCK',
        id: 's3',
        userName: 'Camila Rocha',
        unitCode: 'Torre C · 301',
        chargerName: 'Vaga 01',
        startedAt: `${month}-08T21:00:00.000Z`,
        energyKwh: 21.4,
        amount: 24.04,
        status: 'COMPLETED',
      },
      {
        origin: 'MOCK',
        id: 's4',
        userName: 'Diego Martins',
        unitCode: 'Torre A · 502',
        chargerName: 'Vaga 03',
        startedAt: `${month}-07T17:35:00.000Z`,
        energyKwh: 9.8,
        amount: null,
        status: 'PENDING_REVIEW',
      },
    ],
  };
}
