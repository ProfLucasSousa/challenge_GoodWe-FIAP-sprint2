import {
  AuditSeverity,
  ChargerProvider,
  ChargerStatus,
  DataQuality,
  IntegrationStatus,
  InvoiceStatus,
  PhaseType,
  PrismaClient,
  ReadingSource,
  SessionSource,
  SessionStatus,
  SessionType,
  UserRole,
  VehicleType,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE !== 'true') {
    throw new Error('O seed exige DEMO_MODE=true e é bloqueado em NODE_ENV=production.');
  }
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      'Defina SEED_ADMIN_PASSWORD com pelo menos 12 caracteres para executar o seed.',
    );
  }

  const unit = await prisma.unit.upsert({
    where: { code: 'DEMO-A-101' },
    create: {
      id: '10000000-0000-4000-8000-000000000001',
      code: 'DEMO-A-101',
      block: 'Bloco Demo A',
      description: 'Unidade residencial fictícia para desenvolvimento.',
      responsibleName: 'Responsável Demo A',
    },
    update: {},
  });
  const unitB = await prisma.unit.upsert({
    where: { code: 'DEMO-B-202' },
    create: {
      id: '10000000-0000-4000-8000-000000000002',
      code: 'DEMO-B-202',
      block: 'Bloco Demo B',
      description: 'Unidade corporativa fictícia para desenvolvimento.',
      responsibleName: 'Responsável Demo B',
    },
    update: {},
  });
  const unitC = await prisma.unit.upsert({
    where: { code: 'DEMO-C-303' },
    create: {
      id: '10000000-0000-4000-8000-000000000003',
      code: 'DEMO-C-303',
      block: 'Bloco Demo C',
      description: 'Unidade residencial fictícia para desenvolvimento.',
      responsibleName: 'Responsável Demo C',
    },
    update: {},
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@chargeops.local' },
    create: {
      id: '20000000-0000-4000-8000-000000000001',
      name: 'Administrador de Demonstração',
      email: 'admin@chargeops.local',
      passwordHash: await hash(adminPassword, 12),
      role: UserRole.ADMIN,
    },
    update: { passwordHash: await hash(adminPassword, 12) },
  });
  const lockedPassword = await hash(randomBytes(32).toString('hex'), 12);
  const demoUserA = await prisma.user.upsert({
    where: { email: 'demo.user.a@example.invalid' },
    create: {
      id: '20000000-0000-4000-8000-000000000002',
      name: 'Usuário Demo A',
      email: 'demo.user.a@example.invalid',
      passwordHash: lockedPassword,
      role: UserRole.USER,
      unitId: unit.id,
    },
    update: {},
  });
  const demoUserB = await prisma.user.upsert({
    where: { email: 'demo.user.b@example.invalid' },
    create: {
      id: '20000000-0000-4000-8000-000000000003',
      name: 'Usuário Demo B',
      email: 'demo.user.b@example.invalid',
      passwordHash: lockedPassword,
      role: UserRole.USER,
      unitId: unitB.id,
    },
    update: {},
  });
  const demoUserC = await prisma.user.upsert({
    where: { email: 'demo.user.c@example.invalid' },
    create: {
      id: '20000000-0000-4000-8000-000000000004',
      name: 'Usuário Demo C',
      email: 'demo.user.c@example.invalid',
      passwordHash: lockedPassword,
      role: UserRole.USER,
      unitId: unitC.id,
    },
    update: {},
  });
  const demoManager = await prisma.user.upsert({
    where: { email: 'demo.manager@example.invalid' },
    create: {
      id: '20000000-0000-4000-8000-000000000005',
      name: 'Gestor de Demonstração',
      email: 'demo.manager@example.invalid',
      passwordHash: lockedPassword,
      role: UserRole.MANAGER,
      unitId: unit.id,
    },
    update: {},
  });

  await prisma.vehicle.upsert({
    where: { licensePlate: 'EVDEMO1' },
    create: {
      id: '30000000-0000-4000-8000-000000000001',
      ownerId: demoUserA.id,
      nickname: 'Veículo Demo A',
      model: 'Hatch elétrico fictício',
      licensePlate: 'EVDEMO1',
      type: VehicleType.BEV,
    },
    update: {},
  });
  await prisma.vehicle.upsert({
    where: { licensePlate: 'EVDEMO3' },
    create: {
      id: '30000000-0000-4000-8000-000000000003',
      ownerId: demoUserC.id,
      nickname: 'Veículo Demo C',
      model: 'Sedã elétrico fictício',
      licensePlate: 'EVDEMO3',
      type: VehicleType.BEV,
    },
    update: {},
  });
  await prisma.vehicle.upsert({
    where: { licensePlate: 'EVDEMO4' },
    create: {
      id: '30000000-0000-4000-8000-000000000004',
      ownerId: demoManager.id,
      nickname: 'Veículo do gestor',
      model: 'Crossover híbrido fictício',
      licensePlate: 'EVDEMO4',
      type: VehicleType.PHEV,
    },
    update: {},
  });
  await prisma.vehicle.upsert({
    where: { licensePlate: 'EVDEMO2' },
    create: {
      id: '30000000-0000-4000-8000-000000000002',
      ownerId: demoUserB.id,
      nickname: 'Veículo Demo B',
      model: 'SUV híbrido fictício',
      licensePlate: 'EVDEMO2',
      type: VehicleType.PHEV,
    },
    update: {},
  });
  await prisma.rfidCard.upsert({
    where: { uid: 'MOCK-RFID-0001' },
    create: {
      id: '40000000-0000-4000-8000-000000000001',
      uid: 'MOCK-RFID-0001',
      userId: demoUserA.id,
    },
    update: {},
  });
  await prisma.rfidCard.upsert({
    where: { uid: 'MOCK-RFID-0002' },
    create: {
      id: '40000000-0000-4000-8000-000000000002',
      uid: 'MOCK-RFID-0002',
      userId: demoUserB.id,
    },
    update: {},
  });
  await prisma.rfidCard.upsert({
    where: { uid: 'MOCK-RFID-0003' },
    create: {
      id: '40000000-0000-4000-8000-000000000003',
      uid: 'MOCK-RFID-0003',
      userId: demoUserC.id,
    },
    update: {},
  });

  const chargers = await Promise.all([
    prisma.charger.upsert({
      where: { serialNumber: 'MOCK-HCA-G2-0001' },
      create: {
        id: '50000000-0000-4000-8000-000000000001',
        externalId: 'mock-hca-01',
        serialNumber: 'MOCK-HCA-G2-0001',
        name: 'HCA G2 Demo 22 kW',
        model: 'GW22K-HCA-20',
        nominalPowerKw: 22,
        phaseType: PhaseType.THREE_PHASE,
        location: 'Garagem Demo · Piso G1',
        status: ChargerStatus.CHARGING,
        provider: ChargerProvider.MOCK,
        lastSeenAt: new Date('2026-10-12T12:00:00.000Z'),
      },
      update: {},
    }),
    prisma.charger.upsert({
      where: { serialNumber: 'MOCK-HCA-G2-0002' },
      create: {
        id: '50000000-0000-4000-8000-000000000002',
        externalId: 'mock-hca-02',
        serialNumber: 'MOCK-HCA-G2-0002',
        name: 'HCA G2 Demo 11 kW',
        model: 'GW11K-HCA-20',
        nominalPowerKw: 11,
        phaseType: PhaseType.THREE_PHASE,
        location: 'Garagem Demo · Piso G1',
        status: ChargerStatus.AVAILABLE,
        provider: ChargerProvider.MOCK,
        lastSeenAt: new Date('2026-10-12T12:00:00.000Z'),
      },
      update: {},
    }),
    prisma.charger.upsert({
      where: { serialNumber: 'MOCK-HCA-G2-0003' },
      create: {
        id: '50000000-0000-4000-8000-000000000003',
        externalId: 'mock-hca-03',
        serialNumber: 'MOCK-HCA-G2-0003',
        name: 'HCA G2 Demo 7 kW',
        model: 'GW7K-HCA-20',
        nominalPowerKw: 7,
        phaseType: PhaseType.SINGLE_PHASE,
        location: 'Garagem Demo · Piso G2',
        status: ChargerStatus.OFFLINE,
        provider: ChargerProvider.MOCK,
        lastSeenAt: new Date('2026-10-12T11:15:00.000Z'),
      },
      update: {},
    }),
  ]);

  await prisma.tariff.upsert({
    where: { id: '60000000-0000-4000-8000-000000000001' },
    create: {
      id: '60000000-0000-4000-8000-000000000001',
      name: 'Tarifa residencial padrão',
      pricePerKwh: 1.03,
      operationalFee: 2,
      validFrom: new Date('2026-01-01T00:00:00.000Z'),
    },
    update: {},
  });

  const sampleSessions = [
    {
      id: '70000000-0000-4000-8000-000000000001',
      userId: demoUserA.id,
      vehicleId: '30000000-0000-4000-8000-000000000001',
      chargerId: chargers[0].id,
      startedAt: '2026-10-10T18:20:00.000Z',
      endedAt: '2026-10-10T20:52:00.000Z',
      energy: 18.75,
    },
    {
      id: '70000000-0000-4000-8000-000000000002',
      userId: demoUserB.id,
      vehicleId: '30000000-0000-4000-8000-000000000002',
      chargerId: chargers[1].id,
      startedAt: '2026-10-09T07:10:00.000Z',
      endedAt: '2026-10-09T08:55:00.000Z',
      energy: 14.2,
    },
    {
      id: '70000000-0000-4000-8000-000000000003',
      userId: demoUserA.id,
      vehicleId: '30000000-0000-4000-8000-000000000001',
      chargerId: chargers[1].id,
      startedAt: '2026-10-06T21:00:00.000Z',
      endedAt: '2026-10-06T23:40:00.000Z',
      energy: 21.4,
    },
  ];
  for (const item of sampleSessions) {
    await prisma.chargingSession.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        userId: item.userId,
        vehicleId: item.vehicleId,
        chargerId: item.chargerId,
        startedAt: new Date(item.startedAt),
        endedAt: new Date(item.endedAt),
        energyKwh: item.energy,
        observedEnergyKwh: item.energy,
        averagePowerKw: 7.1,
        sessionType: SessionType.INTERNAL,
        status: SessionStatus.COMPLETED,
        source: SessionSource.MOCK,
        dataQuality: DataQuality.VALID,
      },
      update: {},
    });
  }

  await prisma.chargingReading.upsert({
    where: { id: '80000000-0000-4000-8000-000000000001' },
    create: {
      id: '80000000-0000-4000-8000-000000000001',
      sessionId: sampleSessions[0]!.id,
      chargerId: chargers[0].id,
      externalTimestamp: new Date('2026-10-10T19:20:00.000Z'),
      timestamp: new Date('2026-10-10T19:20:02.000Z'),
      powerKw: 10.8,
      currentA: 15.7,
      voltageV: 230.1,
      accumulatedEnergyKwh: 8.4,
      source: ReadingSource.MOCK,
      rawMetadata: {
        origin: 'MOCK',
        fixture: true,
        description: 'Telemetria inteiramente simulada.',
      },
    },
    update: {},
  });

  const invoice = await prisma.invoice.upsert({
    where: { unitId_referenceMonth: { unitId: unit.id, referenceMonth: '2026-10' } },
    create: {
      id: '90000000-0000-4000-8000-000000000001',
      unitId: unit.id,
      referenceMonth: '2026-10',
      totalKwh: 40.15,
      energyAmount: 41.35,
      operationalFees: 4,
      totalAmount: 45.35,
      status: InvoiceStatus.CLOSED,
      generatedAt: new Date('2026-11-01T09:00:00.000Z'),
      closedAt: new Date('2026-11-01T09:00:00.000Z'),
    },
    update: {},
  });

  await Promise.all([
    prisma.invoiceItem.upsert({
      where: { chargingSessionId: sampleSessions[0]!.id },
      create: {
        id: '91000000-0000-4000-8000-000000000001',
        invoiceId: invoice.id,
        chargingSessionId: sampleSessions[0]!.id,
        energyKwh: 18.75,
        pricePerKwh: 1.03,
        energyAmount: 19.31,
        operationalFee: 2,
        amount: 21.31,
      },
      update: { energyAmount: 19.31 },
    }),
    prisma.invoiceItem.upsert({
      where: { chargingSessionId: sampleSessions[2]!.id },
      create: {
        id: '91000000-0000-4000-8000-000000000002',
        invoiceId: invoice.id,
        chargingSessionId: sampleSessions[2]!.id,
        energyKwh: 21.4,
        pricePerKwh: 1.03,
        energyAmount: 22.04,
        operationalFee: 2,
        amount: 24.04,
      },
      update: { energyAmount: 22.04 },
    }),
  ]);

  await prisma.integrationSync.upsert({
    where: { id: 'a0000000-0000-4000-8000-000000000001' },
    create: {
      id: 'a0000000-0000-4000-8000-000000000001',
      provider: ChargerProvider.MOCK,
      resourceType: 'chargers',
      startedAt: new Date('2026-10-12T12:00:00.000Z'),
      finishedAt: new Date('2026-10-12T12:00:01.000Z'),
      status: IntegrationStatus.SUCCESS,
      recordsReceived: 3,
      recordsCreated: 3,
      metadata: { origin: 'MOCK', fixture: true },
    },
    update: {},
  });

  await prisma.auditEvent.upsert({
    where: { id: 'b0000000-0000-4000-8000-000000000001' },
    create: {
      id: 'b0000000-0000-4000-8000-000000000001',
      type: 'DEMO_DATA_SEEDED',
      severity: AuditSeverity.INFO,
      userId: admin.id,
      message: 'Conjunto de dados fictícios criado para desenvolvimento local.',
      metadata: { origin: 'MOCK', fixture: true, containsPersonalData: false },
    },
    update: {},
  });
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
