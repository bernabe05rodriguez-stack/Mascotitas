import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Movimientos de stock atados al estado del pedido.
 *
 * Regla del negocio: **el stock se descuenta cuando el pedido se ENTREGA**, no
 * cuando se carga. Un pedido pendiente o confirmado todavía no sacó nada de la
 * góndola — recién cuando la mercadería sale, sale del inventario.
 *
 * Todo pasa por `Order.stockApplied`, que dice si ese pedido ya movió stock.
 * Sin esa bandera habría que deducirlo del estado, y ahí aparecen los dobles
 * descuentos: tocar "Entregado" dos veces, o hacer ENTREGADO → CANCELADO →
 * ENTREGADO, restaría dos veces lo mismo.
 *
 * Las cantidades se aplican con `increment`/`decrement`, que resuelve Postgres
 * en la fila: dos ventas simultáneas del mismo producto no se pisan.
 */

/** El cliente de Prisma o el `tx` de una transacción — todo esto corre dentro de una. */
type Tx = PrismaClient | Prisma.TransactionClient;

/** Estados en los que la mercadería ya salió y el stock tiene que estar descontado. */
export function statusConsumesStock(status: string): boolean {
  return status === 'ENTREGADO';
}

interface StockLine {
  productId: string | null;
  variantId: string | null;
  quantity: number;
}

/**
 * Suma (signo +1) o resta (−1) las unidades de un pedido.
 *
 * Si la variante lleva su propio contador de stock se mueve ahí; si no, se mueve
 * el del producto. Es la misma regla que usa la tienda para decidir qué mostrar
 * (`variant.stock ?? product.stock`), así que descontar del otro lado dejaría la
 * pantalla mintiendo.
 */
async function applyDelta(tx: Tx, items: StockLine[], sign: 1 | -1): Promise<void> {
  for (const item of items) {
    if (!item.productId || item.quantity <= 0) continue;

    // ¿Esta variante define stock propio? Sólo entonces se le descuenta a ella.
    const variant = item.variantId
      ? await tx.variant.findUnique({
          where: { id: item.variantId },
          select: { id: true, stock: true },
        })
      : null;

    const delta = item.quantity * sign;

    if (variant && variant.stock !== null) {
      await tx.variant.update({
        where: { id: variant.id },
        // El stock no puede quedar negativo: si se entrega más de lo que
        // figuraba cargado, el piso es 0 y no un número imposible.
        data: { stock: Math.max(0, variant.stock + delta) },
      });
      continue;
    }

    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { stock: true },
    });
    if (!product) continue;

    const next = Math.max(0, product.stock + delta);
    await tx.product.update({
      where: { id: item.productId },
      // `available` es el espejo de `stock > 0` que usa la tienda para mandar lo
      // agotado al final. Se escribe acá mismo, en la misma transacción: si se
      // dejara para un recompute posterior, entre una cosa y la otra el producto
      // aparecería disponible con stock 0.
      data: { stock: next, available: next > 0 },
    });
  }
}

/**
 * Deja el stock consistente con el estado que el pedido pasa a tener.
 *
 * Es idempotente: si el pedido ya está como tiene que estar, no toca nada.
 * Devuelve qué hizo, para poder avisarlo en el panel.
 */
export async function syncOrderStock(
  tx: Tx,
  orderId: number,
  nextStatus: string,
): Promise<'descontado' | 'devuelto' | 'sin-cambios'> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      stockApplied: true,
      items: { select: { productId: true, variantId: true, quantity: true } },
    },
  });
  if (!order) return 'sin-cambios';

  const shouldBeApplied = statusConsumesStock(nextStatus);
  if (shouldBeApplied === order.stockApplied) return 'sin-cambios';

  if (shouldBeApplied) {
    await applyDelta(tx, order.items, -1);
    await tx.order.update({ where: { id: orderId }, data: { stockApplied: true } });
    return 'descontado';
  }

  // Salió de ENTREGADO (se canceló, o fue un error): la mercadería vuelve.
  await applyDelta(tx, order.items, +1);
  await tx.order.update({ where: { id: orderId }, data: { stockApplied: false } });
  return 'devuelto';
}

/**
 * Devuelve al inventario el stock de un pedido que se está por borrar.
 *
 * Borrar la fila sola dejaría las unidades descontadas para siempre, sin ningún
 * pedido que las explique.
 */
export async function releaseOrderStock(tx: Tx, orderId: number): Promise<void> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      stockApplied: true,
      items: { select: { productId: true, variantId: true, quantity: true } },
    },
  });
  if (!order || !order.stockApplied) return;

  await applyDelta(tx, order.items, +1);
}
