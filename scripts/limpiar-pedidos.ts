/**
 * Borra pedidos de prueba y devuelve el stock que hubieran descontado.
 *
 *   npx tsx scripts/limpiar-pedidos.ts            # muestra qué borraría
 *   npx tsx scripts/limpiar-pedidos.ts --confirm  # borra de verdad
 *
 * Por defecto NO borra nada: primero lista. Un borrado de pedidos no se
 * deshace, así que el paso destructivo va detrás de una bandera explícita.
 *
 * Filtros opcionales:
 *   --antes=2026-08-12   sólo pedidos anteriores a esa fecha
 *   --ids=1,2,3          sólo esos pedidos
 *   --todos              todos los pedidos (es lo que hace falta si las pruebas
 *                        son todo lo que hay cargado)
 */
import { PrismaClient } from '@prisma/client';
import { releaseOrderStock } from '../src/lib/stock';

const prisma = new PrismaClient();

function arg(nombre: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  return hit?.split('=')[1];
}

async function main() {
  const confirmar = process.argv.includes('--confirm');
  const todos = process.argv.includes('--todos');
  const antes = arg('antes');
  const idsRaw = arg('ids');

  const where: Record<string, unknown> = {};
  if (idsRaw) {
    where.id = { in: idsRaw.split(',').map((s) => parseInt(s.trim(), 10)).filter(Number.isFinite) };
  } else if (antes) {
    where.createdAt = { lt: new Date(antes) };
  } else if (!todos) {
    console.error(
      'Elegí qué borrar: --todos, --ids=1,2,3 o --antes=AAAA-MM-DD.\n' +
        'Sin filtro no se borra nada, a propósito.',
    );
    process.exit(1);
  }

  const pedidos = await prisma.order.findMany({
    where,
    orderBy: { id: 'asc' },
    include: { items: { select: { productName: true, quantity: true } } },
  });

  if (pedidos.length === 0) {
    console.log('No hay pedidos que coincidan. Nada para hacer.');
    return;
  }

  console.log(`\n${pedidos.length} pedido(s) a borrar:\n`);
  for (const p of pedidos) {
    const detalle = p.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ');
    console.log(
      `  #${p.id}  ${p.status.padEnd(10)} ${p.channel.padEnd(5)} ` +
        `$${p.total.toLocaleString('es-AR').padStart(9)}  ` +
        `${p.stockApplied ? '[stock descontado → se devuelve]' : '[sin stock aplicado]'}  ${detalle}`,
    );
  }

  if (!confirmar) {
    console.log('\nEsto fue sólo un informe. Para borrar de verdad:\n  npx tsx scripts/limpiar-pedidos.ts ' +
      process.argv.slice(2).join(' ') + ' --confirm\n');
    return;
  }

  let devueltos = 0;
  for (const p of pedidos) {
    await prisma.$transaction(async (tx) => {
      // Devolver ANTES de borrar: una vez borrado el pedido, no queda de dónde
      // sacar qué unidades había que reponer.
      if (p.stockApplied) devueltos++;
      await releaseOrderStock(tx, p.id);
      await tx.order.delete({ where: { id: p.id } });
    });
  }

  console.log(`\n✅ ${pedidos.length} pedido(s) borrados. Stock devuelto en ${devueltos} de ellos.\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
