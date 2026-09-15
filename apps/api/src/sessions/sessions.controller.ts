import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { SessionsService } from './sessions.service';

class CreateSessionDto {
  @IsUUID()
  chargerId!: string;

  @IsUUID()
  vehicleId!: string;

  @IsOptional()
  @IsUUID()
  rfidCardId?: string;

  @IsDateString()
  startedAt!: string;
}

class FinishSessionDto {
  @IsDateString()
  endedAt!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  energyKwh!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  averagePowerKw?: number;

  @IsOptional()
  @IsBoolean()
  interrupted = false;

  @IsOptional()
  @IsBoolean()
  validated = true;
}

class AssignUserDto {
  @IsUUID()
  userId!: string;
}

class AssignVehicleDto {
  @IsUUID()
  vehicleId!: string;
}

class AssignRfidDto {
  @IsUUID()
  rfidCardId!: string;
}

@ApiBearerAuth()
@ApiTags('charging-sessions')
@Controller('charging-sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('month') month?: string,
    @Query('userId') userId?: string,
  ) {
    return this.sessions.list(user, { month, userId });
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sessions.getById(user, id);
  }

  @Post('start')
  start(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateSessionDto) {
    return this.sessions.start(user, input);
  }

  @Post(':id/finish')
  finish(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: FinishSessionDto,
  ) {
    return this.sessions.finish(user, id, input);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/assign-user')
  assignUser(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignUserDto,
  ) {
    return this.sessions.assignUser(actor, id, input.userId);
  }

  @Post(':id/assign-vehicle')
  assignVehicle(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignVehicleDto,
  ) {
    return this.sessions.assignVehicle(actor, id, input.vehicleId);
  }

  @Post(':id/assign-rfid')
  assignRfid(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AssignRfidDto,
  ) {
    return this.sessions.assignRfid(actor, id, input.rfidCardId);
  }
}
