import {
  DataQuality,
  InvoiceStatus,
  PrismaClient,
  ReadingSource,
  SessionSource,
  SessionStatus,
  SessionType,
} from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const prisma = new PrismaClient();

function monthReference(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function uuid(prefix: string, sequence: number) {
  return `${prefix}-0000-4000-8000-${sequence.toString(16).padStart(12, '0')}`;
}

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE !== 'true') {
    throw new Error('demo:seed exige DEMO_MODE=true e é bloqueado em NODE_ENV=production.');
  }
  const units = await prisma.unit.findMany({
    where: { code: { startsWith: 'DEMO-' } },
    include: { users: { where: { email: { startsWith: 'demo.' } }, include: { vehicles: true } } },
    orderBy: { code: 'asc' },
  });
  const chargers = await prisma.charger.findMany({
    where: { serialNumber: { startsWith: 'MOCK-HCA-G2-' } },
    orderBy: { serialNumber: 'asc' },
  });
  if (units.length < 2 || chargers.length < 3) {
    throw new Error('Execute o seed base antes do histórico DEMO.');
  }

  const now = new Date('2026-10-01T00:00:00.000Z');
  const months = Array.from(
    { length: 3 },
    (_, offset) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (2 - offset), 1)),
  );
  let sequence = 1;

  for (const month of months) {
    const reference = monthReference(month);
    for (let index = 0; index < 12; index += 1) {
      const unit = units[index % units.length]!;
      const user = unit.users[index % unit.users.length]!;
      const vehicle = user.vehicles[0];
      const charger = chargers[index % chargers.length]!;
      const peakHours = [7, 18, 19, 20, 8, 18, 19, 21, 12, 18, 20, 23];
      const startedAt = new Date(
        Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 2 + index * 2, peakHours[index]!),
      );
      const durationMinutes = index === 11 ? 360 : 55 + ((index * 17) % 125);
      const endedAt = new Date(startedAt.getTime() + durationMinutes * 60_000);
      const energyKwh =
        index === 11
          ? 65
          : Math.round((7.5 + ((index * 37 + month.getUTCMonth()) % 180) / 10) * 1000) / 1000;
      const externalId = `demo-history-${reference}-${String(index + 1).padStart(2, '0')}`;
      const session = await prisma.chargingSession.upsert({
        where: { source_externalId: { source: SessionSource.MOCK, externalId } },
        create: {
          id: uuid('71000000', sequence),
          externalId,
          userId: user.id,
          vehicleId: vehicle?.id,
          chargerId: charger.id,
          startedAt,
          endedAt,
          energyKwh,
          observedEnergyKwh: energyKwh,
          averagePowerKw: Math.round((energyKwh / (durationMinutes / 60)) * 1000) / 1000,
          sessionType: SessionType.INTERNAL,
          status:
            index === 9
              ? SessionStatus.PENDING_REVIEW
              : index === 10
                ? SessionStatus.INTERRUPTED
                : SessionStatus.COMPLETED,
          source: SessionSource.MOCK,
          dataQuality: index === 9 ? DataQuality.PARTIAL : DataQuality.VALID,
          reviewReason:
            index === 9 ? 'Sessão MOCK sem identificação suficiente para faturamento.' : null,
        },
        update: {},
      });

      for (let readingIndex = 0; readingIndex < 3; readingIndex += 1) {
        const timestamp = new Date(
          startedAt.getTime() + (durationMinutes * readingIndex * 60_000) / 3,
        );
        const readingExternalId = `${externalId}-reading-${readingIndex + 1}`;
        await prisma.chargingReading.upsert({
          where: {
            source_externalId: { source: ReadingSource.MOCK, externalId: readingExternalId },
          },
          create: {
            externalId: readingExternalId,
            sessionId: session.id,
            chargerId: charger.id,
            externalTimestamp: timestamp,
            timestamp,
            powerKw: Math.min(Number(charger.nominalPowerKw), 5.5 + ((index + readingIndex) % 7)),
            currentA: 10 + ((index + readingIndex) % 9),
            voltageV: 228 + ((index + readingIndex) % 5) * 0.5,
            accumulatedEnergyKwh: Math.round((energyKwh * (readingIndex + 1) * 1000) / 3) / 1000,
            source: ReadingSource.MOCK,
            rawMetadata: { origin: 'MOCK', fixture: true, demoHistory: true },
          },
          update: {},
        });
      }
      sequence += 1;
    }

    const nextMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    for (let unitIndex = 0; unitIndex < units.length; unitIndex += 1) {
      const unit = units[unitIndex]!;
      const billable = await prisma.chargingSession.findMany({
        where: {
          source: SessionSource.MOCK,
          user: { unitId: unit.id },
          startedAt: { gte: month, lt: nextMonth },
          status: { in: [SessionStatus.COMPLETED, SessionStatus.INTERRUPTED] },
          dataQuality: DataQuality.VALID,
        },
      });
      const totalKwh = billable.reduce(
        (sum, item) => sum + Number(item.observedEnergyKwh ?? item.energyKwh),
        0,
      );
      const energyAmount = Math.round(totalKwh * 1.03 * 100) / 100;
      const fees = billable.length * 2;
      const invoice = await prisma.invoice.upsert({
        where: { unitId_referenceMonth: { unitId: unit.id, referenceMonth: reference } },
        create: {
          id: uuid('92000000', (months.indexOf(month) + 1) * 10 + unitIndex),
          unitId: unit.id,
          referenceMonth: reference,
          totalKwh,
          energyAmount,
          operationalFees: fees,
          totalAmount: energyAmount + fees,
          status: month === months.at(-1) ? InvoiceStatus.OPEN : InvoiceStatus.CLOSED,
          generatedAt: nextMonth,
          closedAt: month === months.at(-1) ? null : nextMonth,
        },
        update: { totalKwh, energyAmount, operationalFees: fees, totalAmount: energyAmount + fees },
      });
      for (const session of billable) {
        const energy = Number(session.observedEnergyKwh ?? session.energyKwh);
        const itemEnergyAmount = Math.round(energy * 1.03 * 100) / 100;
        await prisma.invoiceItem.upsert({
          where: { chargingSessionId: session.id },
          create: {
            invoiceId: invoice.id,
            chargingSessionId: session.id,
            energyKwh: energy,
            pricePerKwh: 1.03,
            energyAmount: itemEnergyAmount,
            operationalFee: 2,
            amount: itemEnergyAmount + 2,
          },
          update: {},
        });
      }
      const totals = await prisma.invoiceItem.aggregate({
        where: { invoiceId: invoice.id },
        _sum: {
          energyKwh: true,
          energyAmount: true,
          operationalFee: true,
          amount: true,
        },
      });
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          totalKwh: totals._sum.energyKwh ?? 0,
          energyAmount: totals._sum.energyAmount ?? 0,
          operationalFees: totals._sum.operationalFee ?? 0,
          totalAmount: totals._sum.amount ?? 0,
        },
      });
    }
  }

  await prisma.auditEvent.upsert({
    where: { id: 'b0000000-0000-4000-8000-000000000002' },
    create: {
      id: 'b0000000-0000-4000-8000-000000000002',
      type: 'DEMO_HISTORY_SEEDED',
      severity: 'INFO',
      message: 'Histórico fictício de três meses criado.',
      metadata: { origin: 'MOCK', months: months.map(monthReference), sessions: sequence - 1 },
    },
    update: {
      metadata: { origin: 'MOCK', months: months.map(monthReference), sessions: sequence - 1 },
    },
  });
  console.log(`DEMO seed concluído: ${sequence - 1} sessões MOCK em 3 meses.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Demo seed failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
