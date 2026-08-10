/**
 * Crea (o actualiza) el usuario del panel.
 *
 *   npx tsx scripts/seed-admin.ts <email> <contraseña> ["Nombre"]
 *
 * Si no se pasan argumentos, toma ADMIN_EMAIL y ADMIN_PASSWORD del entorno.
 * Es idempotente: correrlo de nuevo con otra contraseña la cambia.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const [emailArg, passwordArg, nameArg] = process.argv.slice(2);
  const email = (emailArg ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = passwordArg ?? process.env.ADMIN_PASSWORD ?? '';
  const name = nameArg ?? process.env.ADMIN_NAME ?? null;

  if (!email || !password) {
    console.error('Uso: npx tsx scripts/seed-admin.ts <email> <contraseña> ["Nombre"]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('La contraseña tiene que tener al menos 8 caracteres.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash, name },
    update: { passwordHash, ...(name ? { name } : {}) },
  });

  console.log(`\n✓ Usuario del panel listo: ${user.email}`);
  console.log('  Entrá en /admin/login\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
