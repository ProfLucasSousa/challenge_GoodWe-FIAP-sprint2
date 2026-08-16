import { Module } from '@nestjs/common';
import { RfidCardsController } from './rfid-cards.controller';
import { RfidCardsService } from './rfid-cards.service';

@Module({ controllers: [RfidCardsController], providers: [RfidCardsService] })
export class RfidCardsModule {}
