import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { publicUserSelect } from '../users/user-select';

export interface RfidCardInput {
  uid?: string;
  userId?: string;
  active?: boolean;
}

const cardInclude = { user: { select: publicUserSelect } } satisfies Prisma.RfidCardInclude;

@Injectable()
export class RfidCardsService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthenticatedUser) {
    const where: Prisma.RfidCardWhereInput =
      actor.role === UserRole.ADMIN
        ? {}
        : actor.role === UserRole.MANAGER
          ? { user: { unitId: actor.unitId ?? '__no_unit__' } }
          : { userId: actor.sub };
    return this.prisma.rfidCard.findMany({
      where,
      include: cardInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(actor: AuthenticatedUser, id: string) {
    const card = await this.prisma.rfidCard.findUnique({ where: { id }, include: cardInclude });
    if (!card) throw new NotFoundException('Cartão RFID não encontrado');
    this.assertAccess(actor, card.userId, card.user.unitId);
    return card;
  }

  async create(
    actor: AuthenticatedUser,
    input: Required<Pick<RfidCardInput, 'uid'>> & RfidCardInput,
  ) {
    const userId = actor.role === UserRole.USER ? actor.sub : input.userId;
    if (!userId) throw new ForbiddenException('Usuário vinculado é obrigatório');
    const user = await this.authorizedUser(actor, userId);
    return this.prisma.rfidCard.create({
      data: { uid: input.uid.trim(), userId: user.id },
      include: cardInclude,
    });
  }

  async update(actor: AuthenticatedUser, id: string, input: RfidCardInput) {
    const current = await this.get(actor, id);
    const userId = input.userId ?? current.userId;
    if (actor.role === UserRole.USER && userId !== actor.sub) {
      throw new ForbiddenException('Usuário não pode transferir cartão RFID');
    }
    await this.authorizedUser(actor, userId);
    return this.prisma.rfidCard.update({
      where: { id },
      data: {
        ...(input.uid !== undefined ? { uid: input.uid.trim() } : {}),
        ...(input.userId !== undefined ? { userId } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      include: cardInclude,
    });
  }

  async deactivate(actor: AuthenticatedUser, id: string) {
    await this.get(actor, id);
    return this.prisma.rfidCard.update({
      where: { id },
      data: { active: false },
      include: cardInclude,
    });
  }

  private async authorizedUser(actor: AuthenticatedUser, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, unitId: true, active: true },
    });
    if (!user?.active) throw new NotFoundException('Usuário ativo não encontrado');
    this.assertAccess(actor, user.id, user.unitId);
    return user;
  }

  private assertAccess(actor: AuthenticatedUser, userId: string, unitId: string | null) {
    if (actor.role === UserRole.USER && actor.sub !== userId) {
      throw new ForbiddenException('Acesso a cartão RFID de outro usuário não permitido');
    }
    if (actor.role === UserRole.MANAGER && (!actor.unitId || actor.unitId !== unitId)) {
      throw new ForbiddenException('Acesso a cartão RFID de outra unidade não permitido');
    }
  }
}
