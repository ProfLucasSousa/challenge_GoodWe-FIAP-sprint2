import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AssistantModule } from './assistant/assistant.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ChargersModule } from './chargers/chargers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthController } from './health.controller';
import { InvoicesModule } from './invoices/invoices.module';
import { IntelligenceModule } from './intelligence/intelligence.module';
import { PrismaModule } from './prisma/prisma.module';
import { RfidCardsModule } from './rfid-cards/rfid-cards.module';
import { SessionsModule } from './sessions/sessions.module';
import { UnitsModule } from './units/units.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuthModule,
    AssistantModule,
    ChargersModule,
    SessionsModule,
    InvoicesModule,
    IntelligenceModule,
    DashboardModule,
    UsersModule,
    UnitsModule,
    VehiclesModule,
    RfidCardsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
