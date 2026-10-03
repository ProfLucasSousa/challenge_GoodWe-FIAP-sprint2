import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AssistantController } from '../src/assistant/assistant.controller';
import { AssistantService } from '../src/assistant/assistant.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/auth/roles.guard';
import { InvoicesController } from '../src/invoices/invoices.controller';
import { InvoicesService } from '../src/invoices/invoices.service';
import { IntelligenceController } from '../src/intelligence/intelligence.controller';
import { IntelligenceService } from '../src/intelligence/intelligence.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { RfidCardsController } from '../src/rfid-cards/rfid-cards.controller';
import { RfidCardsService } from '../src/rfid-cards/rfid-cards.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { VehiclesController } from '../src/vehicles/vehicles.controller';
import { VehiclesService } from '../src/vehicles/vehicles.service';

const ids = {
  unitA: '10000000-0000-4000-8000-000000000001',
  unitB: '10000000-0000-4000-8000-000000000002',
  userA: '20000000-0000-4000-8000-000000000001',
  userB: '20000000-0000-4000-8000-000000000002',
  managerA: '20000000-0000-4000-8000-000000000003',
  admin: '20000000-0000-4000-8000-000000000004',
  inactive: '20000000-0000-4000-8000-000000000005',
  vehicleB: '30000000-0000-4000-8000-000000000002',
  cardB: '40000000-0000-4000-8000-000000000002',
};

const now = new Date('2026-10-12T12:00:00.000Z');
const users = [
  {
    id: ids.userA,
    name: 'User A',
    email: 'a@example.invalid',
    role: 'USER',
    unitId: ids.unitA,
    active: true,
    passwordHash: 'secret-a',
  },
  {
    id: ids.userB,
    name: 'User B',
    email: 'b@example.invalid',
    role: 'USER',
    unitId: ids.unitB,
    active: true,
    passwordHash: 'secret-b',
  },
  {
    id: ids.managerA,
    name: 'Manager A',
    email: 'manager@example.invalid',
    role: 'MANAGER',
    unitId: ids.unitA,
    active: true,
    passwordHash: 'secret-manager',
  },
  {
    id: ids.admin,
    name: 'Admin',
    email: 'admin@example.invalid',
    role: 'ADMIN',
    unitId: null,
    active: true,
    passwordHash: 'secret-admin',
  },
  {
    id: ids.inactive,
    name: 'Inactive',
    email: 'inactive@example.invalid',
    role: 'USER',
    unitId: ids.unitA,
    active: false,
    passwordHash: 'secret-inactive',
  },
] as const;

function publicUser(user: (typeof users)[number]) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    unitId: user.unitId,
    active: user.active,
    createdAt: now,
    updatedAt: now,
    unit: user.unitId
      ? { id: user.unitId, code: user.unitId === ids.unitA ? 'A' : 'B', block: null }
      : null,
  };
}

function selectedUser(
  user: (typeof users)[number] | undefined,
  args: { select?: Record<string, unknown> },
) {
  if (!user) return null;
  if (!args.select) return user;
  return Object.fromEntries(
    Object.entries(args.select).map(([key, value]) => {
      if (key === 'unit') return [key, publicUser(user).unit];
      return [
        key,
        value
          ? (user[key as keyof typeof user] ??
            publicUser(user)[key as keyof ReturnType<typeof publicUser>])
          : undefined,
      ];
    }),
  );
}

describe('Authorization (e2e)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const invoices = {
    list: jest.fn().mockResolvedValue([]),
    getById: jest.fn().mockResolvedValue({ id: 'invoice' }),
    generate: jest.fn().mockResolvedValue({ id: 'invoice', status: 'OPEN' }),
    close: jest.fn().mockResolvedValue({ id: 'invoice', status: 'CLOSED' }),
  };
  const intelligence = {
    manager: jest.fn().mockResolvedValue({ sampleSize: 0, anomalies: [], demandForecast: {} }),
  };
  const assistant = {
    query: jest.fn().mockResolvedValue({
      answer: 'O maior pico observado começa às 18:00.',
      sources: [{ metric: 'peak_hour', value: '18:00' }],
    }),
  };

  const prisma = {
    user: {
      findUnique: jest.fn(async (args) =>
        selectedUser(
          users.find((item) => item.id === args.where.id),
          args,
        ),
      ),
      findUniqueOrThrow: jest.fn(async (args) => {
        const user = users.find((item) => item.id === args.where.id);
        if (!user) throw new Error('not found');
        return selectedUser(user, args);
      }),
      findMany: jest.fn(async (args) => {
        const filtered = users.filter((user) => {
          if (args.where.id) return user.id === args.where.id;
          if (args.where.unitId) return user.unitId === args.where.unitId;
          return true;
        });
        return filtered.map(publicUser);
      }),
    },
    vehicle: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === ids.vehicleB
          ? {
              id: ids.vehicleB,
              ownerId: ids.userB,
              model: 'EV B',
              licensePlate: 'TESTB',
              type: 'BEV',
              active: true,
              nickname: null,
              createdAt: now,
              updatedAt: now,
              owner: publicUser(users[1]),
            }
          : null,
      ),
    },
    rfidCard: {
      findUnique: jest.fn(async ({ where }) =>
        where.id === ids.cardB
          ? {
              id: ids.cardB,
              uid: 'RFID-B',
              userId: ids.userB,
              active: true,
              createdAt: now,
              updatedAt: now,
              user: publicUser(users[1]),
            }
          : null,
      ),
    },
  } as unknown as PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret-with-at-least-32-characters' })],
      controllers: [
        UsersController,
        VehiclesController,
        RfidCardsController,
        InvoicesController,
        IntelligenceController,
        AssistantController,
      ],
      providers: [
        UsersService,
        VehiclesService,
        RfidCardsService,
        { provide: InvoicesService, useValue: invoices },
        { provide: IntelligenceService, useValue: intelligence },
        { provide: AssistantService, useValue: assistant },
        { provide: PrismaService, useValue: prisma },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(() => app.close());

  const tokenFor = (id: string) => jwt.sign({ sub: id });

  it('rejects a request without JWT', () =>
    request(app.getHttpServer()).get('/api/users').expect(401));

  it('prevents USER IDOR against another user, vehicle and RFID card', async () => {
    const token = tokenFor(ids.userA);
    await request(app.getHttpServer())
      .get(`/api/users/${ids.userB}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/vehicles/${ids.vehicleB}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/api/rfid-cards/${ids.cardB}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('prevents MANAGER access to another unit', () =>
    request(app.getHttpServer())
      .get(`/api/users/${ids.userB}`)
      .set('Authorization', `Bearer ${tokenFor(ids.managerA)}`)
      .expect(403));

  it('does not return passwordHash and lets ADMIN access all units', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/users/${ids.userB}`)
      .set('Authorization', `Bearer ${tokenFor(ids.admin)}`)
      .expect(200);
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(response.body)).not.toContain('secret-b');
  });

  it('filters USER listings to the authenticated user', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(ids.userA)}`)
      .expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].id).toBe(ids.userA);
    expect(response.body[0]).not.toHaveProperty('passwordHash');
  });

  it('rejects a valid token after the account is inactive', () =>
    request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${tokenFor(ids.inactive)}`)
      .expect(401));

  it('enforces role metadata on privileged endpoints', () =>
    request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${tokenFor(ids.userA)}`)
      .send({ name: 'Blocked', email: 'blocked@example.invalid', password: 'password123' })
      .expect(403));

  it('protects invoice generation and exposes the new collection route', async () => {
    await request(app.getHttpServer())
      .post('/api/invoices/generate')
      .set('Authorization', `Bearer ${tokenFor(ids.userA)}`)
      .send({ unitId: ids.unitA, referenceMonth: '2026-10' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/invoices/generate')
      .set('Authorization', `Bearer ${tokenFor(ids.managerA)}`)
      .send({ unitId: ids.unitA, referenceMonth: '2026-10' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/api/invoices')
      .set('Authorization', `Bearer ${tokenFor(ids.userA)}`)
      .expect(200);
  });

  it('restricts manager intelligence to privileged profiles', async () => {
    await request(app.getHttpServer())
      .get('/api/intelligence/manager')
      .set('Authorization', `Bearer ${tokenFor(ids.userA)}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/intelligence/manager?days=30')
      .set('Authorization', `Bearer ${tokenFor(ids.managerA)}`)
      .expect(200);
    expect(intelligence.manager).toHaveBeenCalledWith(
      expect.objectContaining({ sub: ids.managerA, role: 'MANAGER' }),
      expect.objectContaining({ days: 30 }),
    );
  });

  it('protects the virtual manager and returns traceable aggregate sources', async () => {
    await request(app.getHttpServer())
      .post('/api/assistant/query')
      .set('Authorization', `Bearer ${tokenFor(ids.userA)}`)
      .send({ question: 'Qual horário tem maior demanda?' })
      .expect(403);

    const response = await request(app.getHttpServer())
      .post('/api/assistant/query')
      .set('Authorization', `Bearer ${tokenFor(ids.managerA)}`)
      .send({ question: 'Qual horário tem maior demanda?' })
      .expect(201);

    expect(response.body).toEqual({
      answer: 'O maior pico observado começa às 18:00.',
      sources: [{ metric: 'peak_hour', value: '18:00' }],
    });
    expect(assistant.query).toHaveBeenCalledWith(
      expect.objectContaining({ sub: ids.managerA, role: 'MANAGER', unitId: ids.unitA }),
      'Qual horário tem maior demanda?',
    );
  });
});
