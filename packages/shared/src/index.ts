import { z } from 'zod';

export interface HealthResponse {
  status: 'ok';
}

export type DataOrigin = 'REAL' | 'MOCK' | 'CALCULATED';

export const userRoles = ['ADMIN', 'MANAGER', 'USER'] as const;
export type UserRole = (typeof userRoles)[number];

export const chargerStatuses = ['AVAILABLE', 'CHARGING', 'OFFLINE', 'FAULT', 'UNKNOWN'] as const;
export type ChargerStatus = (typeof chargerStatuses)[number];

export const sessionStatuses = [
  'ACTIVE',
  'COMPLETED',
  'INTERRUPTED',
  'ERROR',
  'PENDING_REVIEW',
] as const;
export type SessionStatus = (typeof sessionStatuses)[number];

export const chargerModels = ['GW7K-HCA-20', 'GW11K-HCA-20', 'GW22K-HCA-20'] as const;
export type ChargerModel = (typeof chargerModels)[number];

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(72),
  role: z.enum(userRoles).default('USER'),
  unitId: z.string().uuid().optional(),
});

export const createSessionSchema = z.object({
  chargerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  rfidCardId: z.string().uuid().optional(),
  startedAt: z.iso.datetime(),
});

export const finishSessionSchema = z.object({
  endedAt: z.iso.datetime(),
  energyKwh: z.number().nonnegative(),
  averagePowerKw: z.number().nonnegative().optional(),
  interrupted: z.boolean().default(false),
  validated: z.boolean().default(true),
});

export const calculateChargeSchema = z.object({
  energyKwh: z.number().nonnegative(),
  tariffKwh: z.number().nonnegative(),
  operationalFee: z.number().nonnegative().default(0),
  validated: z.boolean().default(true),
});

export interface DashboardSummary {
  origin: 'CALCULATED';
  inputOrigins: Array<'REAL' | 'MOCK'>;
  period: string;
  energyKwh: number;
  totalAmount: number;
  sessions: number;
  averageDurationMinutes: number;
  availableChargers: number;
  chargingChargers: number;
  offlineOrFaultChargers: number;
  totalChargers: number;
  pendingSessions: number;
  activeVehicles: number;
  peakHours: Array<{ hour: string; sessions: number }>;
  dailyEnergy: Array<{ day: string; energyKwh: number }>;
  monthlyEnergy: Array<{ month: string; energyKwh: number }>;
  chargerUtilization: Array<{
    chargerId: string;
    chargerName: string;
    utilizationPercent: number;
    idlePercent: number;
  }>;
  energyByUnit: Array<{ unitCode: string; energyKwh: number }>;
  recentSessions: Array<{
    origin: 'REAL' | 'MOCK';
    id: string;
    userName: string;
    unitCode: string;
    chargerName: string;
    startedAt: string;
    energyKwh: number;
    amount: number | null;
    status: SessionStatus;
  }>;
}

export function calculateCharge(input: z.input<typeof calculateChargeSchema>) {
  const parsed = calculateChargeSchema.parse(input);
  if (!parsed.validated) {
    return { energyAmount: 0, operationalFee: 0, totalAmount: 0, billable: false };
  }

  const energyAmount = roundCurrency(parsed.energyKwh * parsed.tariffKwh);
  return {
    energyAmount,
    operationalFee: roundCurrency(parsed.operationalFee),
    totalAmount: roundCurrency(energyAmount + parsed.operationalFee),
    billable: parsed.energyKwh > 0,
  };
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
