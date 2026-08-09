import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { VehicleType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { VehiclesService } from './vehicles.service';

class CreateVehicleDto {
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() nickname?: string;
  @IsString() @MinLength(1) model!: string;
  @IsString() @MinLength(1) licensePlate!: string;
  @IsEnum(VehicleType) type!: VehicleType;
}

class UpdateVehicleDto {
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsString() nickname?: string;
  @IsOptional() @IsString() @MinLength(1) model?: string;
  @IsOptional() @IsString() @MinLength(1) licensePlate?: string;
  @IsOptional() @IsEnum(VehicleType) type?: VehicleType;
  @IsOptional() @IsBoolean() active?: boolean;
}

@ApiBearerAuth()
@ApiTags('vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}
  @Get() list(@CurrentUser() actor: AuthenticatedUser) {
    return this.vehicles.list(actor);
  }
  @Get(':id') get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.vehicles.get(actor, id);
  }
  @Post() create(@CurrentUser() actor: AuthenticatedUser, @Body() input: CreateVehicleDto) {
    return this.vehicles.create(actor, input);
  }
  @Patch(':id') update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateVehicleDto,
  ) {
    return this.vehicles.update(actor, id, input);
  }
  @Delete(':id') deactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vehicles.deactivate(actor, id);
  }
}
