import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

export interface UnitInput {
  code?: string;
  block?: string;
  description?: string;
  responsibleName?: string;
}

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthenticatedUser) {
    return this.prisma.unit.findMany({
      where: actor.role === UserRole.ADMIN ? {} : { id: actor.unitId ?? '__no_unit__' },
      orderBy: { code: 'asc' },
    });
  }

  async get(actor: AuthenticatedUser, id: string) {
    this.assertAccess(actor, id);
    const unit = await this.prisma.unit.findUnique({ where: { id } });
    if (!unit) throw new NotFoundException('Unidade não encontrada');
    return unit;
  }

  create(input: Required<Pick<UnitInput, 'code'>> & UnitInput) {
    return this.prisma.unit.create({ data: input });
  }

  async update(actor: AuthenticatedUser, id: string, input: UnitInput) {
    this.assertAccess(actor, id);
    await this.get(actor, id);
    return this.prisma.unit.update({ where: { id }, data: input });
  }

  private assertAccess(actor: AuthenticatedUser, id: string) {
    if (actor.role !== UserRole.ADMIN && actor.unitId !== id) {
      throw new ForbiddenException('Acesso a outra unidade não permitido');
    }
  }
}
