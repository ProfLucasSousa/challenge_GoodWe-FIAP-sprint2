import { ChargerProvider, PrismaClient, ReadingSource, SessionSource } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.DEMO_MODE !== 'true') {
    throw new Error('demo:reset exige DEMO_MODE=true e é bloqueado em NODE_ENV=production.');
  }
  const demoUnits = await prisma.unit.findMany({
    where: { code: { startsWith: 'DEMO-' } },
    select: { id: true },
  });
  const unitIds = demoUnits.map((unit) => unit.id);

  await prisma.$transaction([
    prisma.invoiceItem.deleteMany({ where: { invoice: { unitId: { in: unitIds } } } }),
    prisma.invoice.deleteMany({ where: { unitId: { in: unitIds } } }),
    prisma.auditEvent.deleteMany({
      where: { OR: [{ source: ChargerProvider.MOCK }, { type: { startsWith: 'DEMO_' } }] },
    }),
    prisma.integrationSync.deleteMany({ where: { provider: ChargerProvider.MOCK } }),
    prisma.chargingReading.deleteMany({ where: { source: ReadingSource.MOCK } }),
    prisma.chargingSession.deleteMany({ where: { source: SessionSource.MOCK } }),
    prisma.rfidCard.deleteMany({ where: { user: { email: { startsWith: 'demo.' } } } }),
    prisma.vehicle.deleteMany({ where: { owner: { email: { startsWith: 'demo.' } } } }),
    prisma.user.deleteMany({ where: { email: { startsWith: 'demo.' } } }),
    prisma.charger.deleteMany({ where: { provider: ChargerProvider.MOCK } }),
    prisma.unit.deleteMany({ where: { id: { in: unitIds } } }),
  ]);
  console.log('Dados DEMO/MOCK removidos. Registros GoodWe/REAL foram preservados.');
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Demo reset failed');
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
