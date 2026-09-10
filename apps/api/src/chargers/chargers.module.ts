import { Module } from '@nestjs/common';
import { ChargersController } from './chargers.controller';
import { ChargersService } from './chargers.service';
import { DemoHybridChargerProvider } from './demo-hybrid-charger.provider';
import { CHARGER_PROVIDER } from './charger-provider';
import { GoodWeApiClient } from './goodwe-api.client';
import { GoodWeAuthClient } from './goodwe-auth.client';
import { GoodWeHttpClient } from './goodwe-http.client';
import { GoodWeMapper } from './goodwe-mapper';
import { GoodWePayloadParser } from './goodwe-payload.parser';
import { GoodWeSemsProvider } from './goodwe-sems.provider';
import { MockChargerProvider } from './mock-charger.provider';

@Module({
  controllers: [ChargersController],
  providers: [
    ChargersService,
    MockChargerProvider,
    GoodWeAuthClient,
    GoodWeHttpClient,
    GoodWePayloadParser,
    GoodWeMapper,
    GoodWeApiClient,
    GoodWeSemsProvider,
    DemoHybridChargerProvider,
    {
      provide: CHARGER_PROVIDER,
      inject: [MockChargerProvider, GoodWeSemsProvider, DemoHybridChargerProvider],
      useFactory: (
        mock: MockChargerProvider,
        goodwe: GoodWeSemsProvider,
        demo: DemoHybridChargerProvider,
      ) => {
        if (process.env.DEMO_MODE === 'true') return demo;
        return process.env.CHARGER_PROVIDER === 'goodwe' ? goodwe : mock;
      },
    },
  ],
  exports: [ChargersService, MockChargerProvider, GoodWeSemsProvider, DemoHybridChargerProvider],
})
export class ChargersModule {}
