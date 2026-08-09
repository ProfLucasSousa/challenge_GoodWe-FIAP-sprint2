import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole, VehicleType } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { publicUserSelect } from '../users/user-select';

export interface VehicleInput {
  ownerId?: string;
  nickname?: string;
  model?: string;
  licensePlate?: string;
  type?: VehicleType;
  active?: boolean;
}

const vehicleInclude = { owner: { select: publicUserSelect } } satisfies Prisma.VehicleInclude;

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthenticatedUser) {
    const where: Prisma.VehicleWhereInput =
      actor.role === UserRole.ADMIN
        ? {}
        : actor.role === UserRole.MANAGER
          ? { owner: { unitId: actor.unitId ?? '__no_unit__' } }
          : { ownerId: actor.sub };
    return this.prisma.vehicle.findMany({
      where,
      include: vehicleInclude,
      orderBy: { model: 'asc' },
    });
  }

  async get(actor: AuthenticatedUser, id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: vehicleInclude,
    });
    if (!vehicle) throw new NotFoundException('Veículo não encontrado');
    this.assertAccess(actor, vehicle.ownerId, vehicle.owner.unitId);
    return vehicle;
  }

  async create(
    actor: AuthenticatedUser,
    input: Required<Pick<VehicleInput, 'model' | 'licensePlate' | 'type'>> & VehicleInput,
  ) {
    if (actor.role === UserRole.USER && input.ownerId && input.ownerId !== actor.sub) {
      throw new ForbiddenException('Usuário não pode cadastrar veículo para outra pessoa');
    }
    const ownerId = actor.role === UserRole.USER ? actor.sub : input.ownerId;
    if (!ownerId) throw new ForbiddenException('Proprietário é obrigatório');
    const owner = await this.authorizedOwner(actor, ownerId);
    return this.prisma.vehicle.create({
      data: {
        ownerId: owner.id,
        nickname: input.nickname,
        model: input.model,
        licensePlate: input.licensePlate.toUpperCase(),
        type: input.type,
      },
      include: vehicleInclude,
    });
  }

  async update(actor: AuthenticatedUser, id: string, input: VehicleInput) {
    const current = await this.get(actor, id);
    const ownerId = input.ownerId ?? current.ownerId;
    if (actor.role === UserRole.USER && ownerId !== actor.sub) {
      throw new ForbiddenException('Usuário não pode transferir veículo');
    }
    await this.authorizedOwner(actor, ownerId);
    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(input.ownerId !== undefined ? { ownerId } : {}),
        ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        ...(input.model !== undefined ? { model: input.model } : {}),
        ...(input.licensePlate !== undefined
          ? { licensePlate: input.licensePlate.toUpperCase() }
          : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      include: vehicleInclude,
    });
  }

  async deactivate(actor: AuthenticatedUser, id: string) {
    await this.get(actor, id);
    return this.prisma.vehicle.update({
      where: { id },
      data: { active: false },
      include: vehicleInclude,
    });
  }

  private async authorizedOwner(actor: AuthenticatedUser, ownerId: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, unitId: true, active: true },
    });
    if (!owner?.active) throw new NotFoundException('Proprietário ativo não encontrado');
    this.assertAccess(actor, owner.id, owner.unitId);
    return owner;
  }

  private assertAccess(actor: AuthenticatedUser, ownerId: string, unitId: string | null) {
    if (actor.role === UserRole.USER && actor.sub !== ownerId) {
      throw new ForbiddenException('Acesso a veículo de outro usuário não permitido');
    }
    if (actor.role === UserRole.MANAGER && (!actor.unitId || actor.unitId !== unitId)) {
      throw new ForbiddenException('Acesso a veículo de outra unidade não permitido');
    }
  }
}
