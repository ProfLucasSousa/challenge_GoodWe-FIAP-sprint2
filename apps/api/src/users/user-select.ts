import { Prisma } from '@prisma/client';

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  active: true,
  unitId: true,
  createdAt: true,
  updatedAt: true,
  unit: { select: { id: true, code: true, block: true } },
} satisfies Prisma.UserSelect;
