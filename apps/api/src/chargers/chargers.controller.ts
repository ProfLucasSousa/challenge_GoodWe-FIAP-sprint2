import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { ChargersService } from './chargers.service';

@ApiBearerAuth()
@ApiTags('chargers')
@Controller('chargers')
export class ChargersController {
  constructor(private readonly chargers: ChargersService) {}

  @Get()
  list() {
    return this.chargers.list();
  }

  @Get(':id/operational')
  operational(@Param('id', ParseUUIDPipe) id: string) {
    return this.chargers.operational(id);
  }

  @Get('provider/health')
  providerHealth() {
    return this.chargers.providerHealth();
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('sync')
  sync() {
    return this.chargers.sync();
  }
}
