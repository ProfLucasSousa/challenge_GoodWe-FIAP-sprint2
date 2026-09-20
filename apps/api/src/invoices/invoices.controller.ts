import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { CurrentUser, type AuthenticatedUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { InvoicesService } from './invoices.service';

class GenerateInvoiceDto {
  @IsUUID()
  unitId!: string;

  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  referenceMonth!: string;
}

class ListInvoicesDto {
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  referenceMonth?: string;

  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;
}

@ApiBearerAuth()
@ApiTags('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListInvoicesDto) {
    return this.invoices.list(user, query);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.getById(user, id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('generate')
  generate(@CurrentUser() user: AuthenticatedUser, @Body() input: GenerateInvoiceDto) {
    return this.invoices.generate(user, input.unitId, input.referenceMonth);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/close')
  close(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.invoices.close(user, id);
  }
}
