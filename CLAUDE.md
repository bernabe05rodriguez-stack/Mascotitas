# CLAUDE.md — Mascotitas

Se carga solo al trabajar en este repo. Info general y accesos: `proyectos/Mascotitas.md` en el vault de Obsidian. Log de cambios: `proyectos/Mascotitas-historial.md`.

📚 **Detalle técnico en [`LECCIONES.md`](LECCIONES.md)** (migración de Google Sheets a Postgres, trampas de Next.js, verificación de deploys). Creado el 2026-08-20 desde el `_lecciones.md` del vault.

## Qué es

Tienda online de alimento para mascotas en Mendoza. **Next.js + Postgres + Prisma**, panel propio en `/admin`, página por producto, carrito persistente, pedidos en la base, cupones server-side.

En producción: **https://mascotitas.online** · 268 productos / 359 presentaciones.

## 🔴 Reglas duras

1. **El servicio que sirve el dominio es `mascotitas-v2`, NO `mascotitas`.**
   `mascotitas` es la v1 de rollback (rama `v1-rollback`). Deployar "mascotitas" **no toca el sitio**.
   Antes de deployar, mirar `source.ref` + `primaryDomainId` con `inspectService`.

2. **Las subidas de usuario NO van en `public/`.**
   Next arma la lista de archivos estáticos **al arrancar**: una foto escrita ahí después da 404 hasta reiniciar el contenedor. Van a `UPLOADS_DIR` (volumen en `/app/uploads`) y se sirven con la ruta `/uploads/[...file]`.

3. **Un deploy con HTTP 200 no significa que el build haya salido bien.**
   Con `zeroDowntime`, si el contenedor nuevo falla el viejo sigue sirviendo y no hay síntoma externo. La única verdad es `inspectService` → `.commit.sha` contra `git ls-remote origin main`.

4. **El stock tiene un solo dueño.**
   Se escribe desde un módulo único, idempotente, con la bandera persistida `stockApplied` y en la misma transacción que el estado del pedido. Sin la bandera, un ciclo ENTREGADO→CANCELADO→ENTREGADO resta dos veces.

5. **Verificar en producción, no en local.** Ver la lección del vault: los 3 bugs serios de agosto aparecieron de casualidad porque los chequeos probaban *lo de al lado*.

## Deploy

```bash
curl -s -X POST "https://bm6z1s.easypanel.host/api/trpc/services.app.deployService" \
  -H "Authorization: Bearer <API key EasyPanel>" -H "Content-Type: application/json" \
  -d '{"json":{"projectName":"redhawk","serviceName":"mascotitas-v2"}}'
```

Auto-deploy **no** está conectado: cada push necesita este disparo manual.

## Paleta

Cream `#F6F4EF` (⚠️ delta R−B < 10 o se lee marrón) · navy `#1B3C59` · coral `#E07A3C` como **único** CTA. Fraunces + Poppins.
