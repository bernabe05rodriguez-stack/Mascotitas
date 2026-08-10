import { PrismaClient } from '@prisma/client';

// En dev, Next recarga los módulos en cada cambio: sin este singleton se abren
// decenas de pools contra Postgres hasta agotar las conexiones.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
