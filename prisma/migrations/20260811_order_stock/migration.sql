-- Stock atado al estado del pedido.
--
-- Antes: el punto de venta descontaba stock al crear el pedido, y el selector de
-- estado no tocaba nada. Ahora el stock se mueve al pasar a ENTREGADO y se
-- devuelve al salir de ese estado, con `stockApplied` como bandera para que la
-- operación sea idempotente.

ALTER TABLE "Order" ADD COLUMN "stockApplied" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "variantId" TEXT;

-- Backfill. Los pedidos del local que ya existen SÍ descontaron stock con el
-- código viejo (lo hacían al crearse). Marcarlos como aplicados es lo que evita
-- que, al pasarlos a ENTREGADO, se les descuente una segunda vez.
UPDATE "Order"
SET "stockApplied" = true
WHERE "channel" = 'LOCAL' AND "status" <> 'CANCELADO';

-- Los pedidos web nunca movieron stock, así que quedan en false: correcto.

CREATE INDEX "Order_phone_idx" ON "Order"("phone");
