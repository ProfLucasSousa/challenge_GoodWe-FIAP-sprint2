import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { publicUserSelect } from './user-select';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  unitId?: string;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  unitId?: string | null;
  active?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthenticatedUser) {
    const where: Prisma.UserWhereInput =
      actor.role === UserRole.ADMIN
        ? {}
        : actor.role === UserRole.MANAGER
          ? { unitId: actor.unitId ?? '__no_unit__' }
          : { id: actor.sub };
    return this.prisma.user.findMany({ where, select: publicUserSelect, orderBy: { name: 'asc' } });
  }

  async get(actor: AuthenticatedUser, id: string) {
    const target = await this.findAuthorized(actor, id);
    return this.prisma.user.findUniqueOrThrow({
      where: { id: target.id },
      select: publicUserSelect,
    });
  }

  async create(actor: AuthenticatedUser, input: CreateUserInput) {
    const role = input.role ?? UserRole.USER;
    const unitId = actor.role === UserRole.MANAGER ? actor.unitId : (input.unitId ?? null);
    if (
      actor.role === UserRole.MANAGER &&
      (role !== UserRole.USER || !unitId || (input.unitId !== undefined && input.unitId !== unitId))
    ) {
      throw new ForbiddenException('Gestores só podem criar usuários da própria unidade');
    }
    return this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: await hash(input.password, 12),
        role,
        unitId,
      },
      select: publicUserSelect,
    });
  }

  async update(actor: AuthenticatedUser, id: string, input: UpdateUserInput) {
    const target = await this.findAuthorized(actor, id);
    if (
      actor.role === UserRole.USER &&
      (input.role || input.unitId !== undefined || input.active !== undefined)
    ) {
      throw new ForbiddenException('Usuário não pode alterar perfil, unidade ou estado');
    }
    if (actor.role === UserRole.MANAGER) {
      if (target.role !== UserRole.USER || (input.role && input.role !== UserRole.USER)) {
        throw new ForbiddenException('Gestor não pode alterar contas privilegiadas');
      }
      if (input.unitId !== undefined && input.unitId !== actor.unitId) {
        throw new ForbiddenException('Gestor não pode mover usuário para outra unidade');
      }
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email.toLowerCase() } : {}),
        ...(input.password !== undefined ? { passwordHash: await hash(input.password, 12) } : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.unitId !== undefined ? { unitId: input.unitId } : {}),
        ...(input.active !== undefined ? { active: input.active } : {}),
      },
      select: publicUserSelect,
    });
  }

  async deactivate(actor: AuthenticatedUser, id: string) {
    const target = await this.findAuthorized(actor, id);
    if (actor.role === UserRole.MANAGER && target.role !== UserRole.USER) {
      throw new ForbiddenException('Gestor não pode desativar contas privilegiadas');
    }
    return this.prisma.user.update({
      where: { id },
      data: { active: false },
      select: publicUserSelect,
    });
  }

  private async findAuthorized(actor: AuthenticatedUser, id: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, unitId: true },
    });
    if (!target) throw new NotFoundException('Usuário não encontrado');
    if (actor.role === UserRole.USER && actor.sub !== id) {
      throw new ForbiddenException('Acesso a outro usuário não permitido');
    }
    if (actor.role === UserRole.MANAGER && (!actor.unitId || target.unitId !== actor.unitId)) {
      throw new ForbiddenException('Acesso a outra unidade não permitido');
    }
    return target;
  }
}
