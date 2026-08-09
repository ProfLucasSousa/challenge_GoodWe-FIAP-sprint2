import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { UnitsService } from './units.service';

class CreateUnitDto {
  @IsString() @MinLength(1) code!: string;
  @IsOptional() @IsString() block?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() responsibleName?: string;
}

class UpdateUnitDto {
  @IsOptional() @IsString() @MinLength(1) code?: string;
  @IsOptional() @IsString() block?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() responsibleName?: string;
}

@ApiBearerAuth()
@ApiTags('units')
@Controller('units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get() list(@CurrentUser() actor: AuthenticatedUser) {
    return this.units.list(actor);
  }
  @Get(':id') get(@CurrentUser() actor: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.units.get(actor, id);
  }

  @Roles('ADMIN')
  @Post()
  create(@Body() input: CreateUnitDto) {
    return this.units.create(input);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateUnitDto,
  ) {
    return this.units.update(actor, id, input);
  }
}
