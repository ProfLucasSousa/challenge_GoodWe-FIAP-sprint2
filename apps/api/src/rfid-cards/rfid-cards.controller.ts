import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RfidCardsService } from './rfid-cards.service';

class CreateRfidCardDto {
  @IsString() @MinLength(1) uid!: string;
  @IsOptional() @IsUUID() userId?: string;
}

class UpdateRfidCardDto {
  @IsOptional() @IsString() @MinLength(1) uid?: string;
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

@ApiBearerAuth()
@ApiTags('rfid-cards')
@Controller('rfid-cards')
export class RfidCardsController {
  constructor(private readonly cards: RfidCardsService) {}
  @Get() list(@CurrentUser() actor: AuthenticatedUser) {
    return this.cards.list(actor);
  }
  @Get(':id') get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cards.get(actor, id);
  }
  @Roles('ADMIN', 'MANAGER')
  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() input: CreateRfidCardDto) {
    return this.cards.create(actor, input);
  }
  @Roles('ADMIN', 'MANAGER')
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateRfidCardDto,
  ) {
    return this.cards.update(actor, id, input);
  }
  @Roles('ADMIN', 'MANAGER')
  @Delete(':id')
  deactivate(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.cards.deactivate(actor, id);
  }
}
