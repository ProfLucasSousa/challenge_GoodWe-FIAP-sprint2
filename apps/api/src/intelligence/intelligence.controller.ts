import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { IntelligenceService } from './intelligence.service';

class ManagerIntelligenceQuery {
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  days = 90;
}

@ApiBearerAuth()
@ApiTags('intelligence')
@Controller('intelligence')
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Roles('ADMIN', 'MANAGER')
  @Get('manager')
  manager(@CurrentUser() actor: AuthenticatedUser, @Query() query: ManagerIntelligenceQuery) {
    return this.intelligence.manager(actor, query);
  }
}
