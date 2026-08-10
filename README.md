# Mascotitas

Tienda de alimento y accesorios para mascotas — Mendoza. `mascotitas.online`

Next.js 14 (App Router) + Postgres + Prisma. Reemplaza a la versión anterior:
un único `index.html` que leía el catálogo de un Google Sheet publicado como CSV.

## Qué cambió respecto de la v1

| | Antes | Ahora |
|---|---|---|
| Datos | Google Sheet público (CSV) | Postgres |
| Carga de productos | Editar la planilla | Panel en `/admin` |
| Identidad de producto | `Math.random()` en cada carga (201 de 268 sin id) | slug estable |
| Carrito | Se perdía al refrescar | Persistente en localStorage |
| Pedidos | Sólo en el chat de WhatsApp | Registrados en la base |
| URLs | Una sola página | Una por producto |
| Imágenes | postimg.cc (hosting de terceros) | Propias, en WebP |
| Cupones | Pestaña pública del Sheet | Validados en el servidor |

## Desarrollo

Requiere **Node 20+** (sharp y Next lo necesitan).

```bash
npm install

# Postgres local sin docker ni root (queda corriendo en :55432)
npx tsx scripts/dev-db.ts start

cp .env.example .env      # completar DATABASE_URL y AUTH_SECRET
npx prisma migrate deploy
npm run migrate:sheet     # carga el catálogo desde data/
npm run fetch:images      # baja las fotos (ya están en data/images)
npx tsx scripts/seed-admin.ts admin@mascotitas.online <contraseña> "Berna"

npm run dev
```

### Verificación antes de deployar

```bash
npm run build
npx tsx scripts/e2e-check.ts http://localhost:3100
```

Chequea los caminos que importan: que el catálogo liste los 268 productos, que
el carrito sobreviva al refresh, que los precios de un pedido los ponga el
servidor y no el navegador, que `/api/admin/*` rechace a los no autenticados y
que un cambio del panel se vea en la tienda.

## El catálogo y la regla de no perder nada

`data/catalogo-snapshot-2026-08-10.csv` es la foto del Google Sheet el día de la
migración: **268 productos, 359 presentaciones, 305 imágenes**. Es el respaldo y
no se toca.

Además, cada producto guarda en `legacyRaw` su fila original completa, visible
al pie de su ficha en el panel. Si alguna vez hay dudas sobre un dato migrado,
el original está ahí.

`scripts/migrate-sheet.ts` es idempotente y verifica los conteos al terminar; si
algo no cuadra, sale con error en vez de dejar la base a medias.

```bash
npm run migrate:dry              # informe, sin tocar la base
npm run migrate:sheet            # escribe
npm run migrate:sheet -- --live  # relee el Sheet en vivo en vez del snapshot
```

## Imágenes

Las 305 fotos vivían en `postimg.cc`, un hosting gratuito sin backup: si se caía,
se perdía el catálogo visual entero. `scripts/fetch-images.ts` las bajó y las
convirtió a WebP en dos tamaños (400px para las cards, 900px para la ficha):
27 MB → 15 MB, y cada card pasó de ~150 KB a ~14 KB.

Quedan versionadas en `data/images/`. En producción se sirven desde el volumen
`public/uploads`, que el arranque resiembra desde `data/images` si está vacío —
así un volumen perdido no se lleva las fotos.

## Deploy (EasyPanel)

Servicios en el proyecto `redhawk`:

- `mascotitas` — la app, build por Dockerfile
- `mascotitas-db` — Postgres 16

Variables de entorno de la app:

```
DATABASE_URL=postgres://postgres:<password>@mascotitas-db:5432/mascotitas
AUTH_SECRET=<openssl rand -hex 32>
NEXT_PUBLIC_SITE_URL=https://mascotitas.online
ADMIN_EMAIL=<mail>
ADMIN_PASSWORD=<contraseña, 8+ caracteres>
```

**Volumen obligatorio:** montar en `/app/public/uploads`. Sin eso, las fotos que
se suban desde el panel se pierden en cada deploy.

El arranque (`docker-entrypoint.sh`) aplica migraciones, restaura las fotos al
volumen y siembra el catálogo **sólo si la base está vacía** — nunca pisa datos
existentes.

Auto-deploy no está conectado. Después de pushear:

```bash
curl -sk -X POST "https://84.46.252.202/api/trpc/services.app.deployService" \
  -H "Host: panel.redhawk.digital" \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"json":{"projectName":"redhawk","serviceName":"mascotitas"}}'
```

(El IP directo es el workaround al TLS roto de `panel.redhawk.digital`.)

## Cosas que conviene saber

- **`prisma migrate deploy`, nunca `db push --accept-data-loss`** en producción:
  en esta base viven los pedidos y un push puede borrar columnas en silencio.
- **`requireAdmin()` va en cada server action y route handler.** El middleware
  de Next no cubre las rutas de API — sólo redirige páginas.
- **`AUTH_SECRET` vacío rompe toda la auth en silencio.** `src/lib/auth.ts` tira
  error si falta o es corto, a propósito.
- Los nombres se guardan como se cargan (en mayúscula) y se capitalizan sólo al
  mostrarlos (`displayName`). El dato original nunca se pisa.
- El fondo `#F6F4EF` no es negociable: con más chroma (delta R-B > 10) se lee
  marrón contra las cards blancas. Ya se probó.
- Las fotos de producto traen fondo blanco embebido: el área de imagen tiene que
  ser `bg-white` o se ve como un recuadro pegado.
