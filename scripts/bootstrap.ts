/**
 * Arranque del contenedor: siembra el catálogo sólo si la base está vacía.
 *
 * La condición es estricta a propósito — si ya hay un solo producto, no toca
 * nada. Un reinicio del contenedor jamás puede pisar el catálogo que el
 * negocio viene editando desde el panel.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [products, admins] = await Promise.all([prisma.product.count(), prisma.adminUser.count()]);

  if (products > 0) {
    console.log(`  catálogo ya cargado (${products} productos) — no se toca nada`);
  } else {
    console.log('  base vacía: sembrando el catálogo desde el snapshot del Sheet');
    // Import dinámico: sólo se carga cuando de verdad hace falta sembrar.
    const { seedFromSnapshot } = await import('./seed-catalog');
    await seedFromSnapshot(prisma);
  }

  if (admins === 0) {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (email && password && password.length >= 8) {
      const bcrypt = (await import('bcryptjs')).default;
      await prisma.adminUser.create({
        data: {
          email: email.trim().toLowerCase(),
          passwordHash: await bcrypt.hash(password, 10),
          name: process.env.ADMIN_NAME ?? null,
        },
      });
      console.log(`  usuario del panel creado: ${email}`);
    } else {
      console.warn('  ! No hay usuarios del panel. Definí ADMIN_EMAIL y ADMIN_PASSWORD (8+ caracteres) y reiniciá.');
    }
  }
}

main()
  .catch((e) => {
    console.error('  ! Falló el arranque:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
