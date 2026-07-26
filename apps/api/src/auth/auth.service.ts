import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user?.active || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      unitId: user.unitId,
    });
    return { accessToken, user: this.safeUser(user) };
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { unit: true } });
    if (!user?.active) throw new UnauthorizedException();
    return this.safeUser(user);
  }

  private safeUser(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    unitId: string | null;
    unit?: unknown;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      unitId: user.unitId,
      ...('unit' in user ? { unit: user.unit } : {}),
    };
  }
}
