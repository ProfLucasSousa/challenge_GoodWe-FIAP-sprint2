import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedUser } from './current-user.decorator';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) throw new UnauthorizedException('Token ausente ou inválido');

    try {
      const claims = await this.jwtService.verifyAsync<AuthenticatedUser>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: claims.sub },
        select: { id: true, email: true, role: true, unitId: true, active: true },
      });
      if (!user?.active) throw new UnauthorizedException('Usuário inativo ou inexistente');
      request.user = {
        sub: user.id,
        email: user.email,
        role: user.role,
        unitId: user.unitId,
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Token expirado ou inválido');
    }
  }
}
