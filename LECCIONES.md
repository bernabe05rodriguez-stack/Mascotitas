# Mascotitas — Lecciones aprendidas

> Movidas desde `_lecciones.md` del vault de Obsidian el 2026-08-20: ese archivo se carga entero
> al inicio de cada sesión y había crecido demasiado. Lo específico de cada proyecto vive ahora
> al lado de su código. Las lecciones **generales** (deploy/EasyPanel, diseño, Claude Code)
> siguen en el vault: `Obsidian/Berna Notebook/_lecciones.md`.

---

### Mascotitas - Google Sheets como backend (CSV publicado) — ⚠️ SUPERADO en 2026-08-10, migrado a Postgres
- *El CSV publicado de Google Sheets NO transporta formato de celda* (colores, negrita, etc.) — es texto plano. Si el cliente pinta una celda de verde esperando que la web "lo lea", **no funciona** vía `pub?output=csv`. Solución: **columna dedicada** (un checkbox o un texto tipo `x`/`SI`) que el cliente edita, y el JS la matchea. Un checkbox de Sheets exporta `TRUE`/`FALSE` en el CSV. *(Si fuera imprescindible leer el color real, habría que ir a la API de Sheets v4 con `includeGridData` + API key, mucho más frágil — evitar.)*
- *Match flexible de columnas del Sheet*: el cliente tipea encabezados con typos/plurales (`Destacadas`, `Precios 2 descuneto`). Detectar columnas por `Object.keys(item).find(k => k.toLowerCase().includes('destac'))` en vez de nombre exacto. Ya se usaba para los descuentos; replicado para destacados.
- *Carrusel de destacados controlable a mano*: patrón "si hay marcados manualmente, mostrar SOLO esos; si no, fallback automático (ofertas + stock)" — le da control total al cliente sin romper cuando no marca nada. Requiere `stock > 0` para no destacar agotados.
- *Deploy Mascotitas/EasyPanel con TLS roto del panel*: el disparo por API (`services.app.deployService`) da **HTTP 000** porque el cert del panel está roto; requiere `curl -k`, que el **clasificador de seguridad de Claude bloquea** (manda el Bearer token por conexión sin verificar). Fallback fiable: el usuario aprieta **Deploy** desde el panel a mano. La verificación post-deploy del sitio público (`mascotitas.online`) sí anda con `curl` normal (200 + grep del cambio en el HTML).
- *Hostname correcto para la API de EasyPanel (2026-06-11)*: la API tRPC tiene **cert TLS válido** en `https://bm6z1s.easypanel.host/api/trpc/...` (el dominio base del wildcard, sin subdominio) — probado `projects.listProjects` y `services.app.deployService` → 200 con `curl` normal + Bearer token, conexión verificada. `panel.redhawk.digital` sigue con el cert roto (alert internal error). Usar siempre el hostname bueno; ya no hace falta disparar el deploy a mano desde el panel. Detalles en `credenciales/easypanel.md`.

### Mascotitas - Migración de Google Sheets a Postgres + Next.js (2026-08-10/11, [[proyectos/Mascotitas|Mascotitas]])

**Next.js — trampas que costaron caídas:**
- *NO se pueden guardar subidas de usuario en `public/`*. Next arma la lista de archivos estáticos **al arrancar**: una foto escrita ahí después da **404 hasta reiniciar el contenedor**. Guardarlas afuera (`UPLOADS_DIR`) y servirlas con una ruta `/uploads/[...file]`. Aplica a cualquier proyecto Next con uploads — **Katsuda va a tener el mismo problema**.
- *Una server action vuelve a renderizar la página que la invocó*, aunque no llames a `revalidatePath`. Si eso molesta (una fila que desaparece de una lista filtrada al cambiarle el estado), usar una **ruta de API** con `fetch`.
- *`next build` corre `generateStaticParams` y prerenderiza las páginas con `revalidate`* → si consultan la base, el build necesita la base. En EasyPanel no existe durante el build y el `docker build` sale con código 1. Las páginas que leen datos van `force-dynamic`.
- *`output: standalone` hace `chdir` a su propio directorio*, así que `process.cwd()` NO es la raíz del repo. Afecta a todo lo que resuelva rutas relativas.

**Deploy / verificación — la lección cara:**
- *NUNCA apuntar el dominio de producción a un contenedor que no se vio funcionar.* Se hizo y fueron **15 minutos de 502 en un sitio con ventas**. El camino correcto (servicio de prueba con dominio propio → verificar → mover el dominio) es igual de rápido y sin riesgo. Ver [[feedback_deploy_verificar_contenedor]] en memoria.
- *Verificar EN PRODUCCIÓN, no en la máquina propia.* Dos veces en el mismo día un "está hecho" no lo estaba: las fotos seguían viniendo de postimg.cc, y las fotos subidas desde el panel no se servían. Las dos veces el chequeo probaba **lo de al lado** (que el archivo existiera / que el upload rechazara a los anónimos) en vez de lo que importaba (que la imagen se viera).
- *Si la plataforma no da logs, el arranque no puede abortar en silencio*: registrar todo en un archivo, levantar igual, y exponerlo por HTTP con token. Un contenedor que muere se ve desde afuera como un 502 mudo.
- *`zeroDowntime` de EasyPanel*: el contenedor viejo sigue sirviendo un rato después de que el healthcheck responde 200. Una acción de mantenimiento disparada enseguida le pega al viejo y parece no hacer nada.

**Herramientas / shell:**
- *`--exclude 'carpeta'` en rsync y `carpeta/` en .gitignore matchean CUALQUIER carpeta con ese nombre*, no sólo la de la raíz. Un `--exclude 'uploads'` se comió `src/app/uploads/` y la app deployada quedó sin la ruta que servía las imágenes. **Anclar con `/` inicial.**
- *NUNCA `rsync --delete`/`--delete-excluded` contra un directorio versionado*: se lleva puesto el `.git`. Ya pasó. Ver [[feedback_rsync_git_repo]].
- *`tsx` inyecta `__name` en el código que se pasa a `page.evaluate()` de Playwright* → `ReferenceError`. Compilar con esbuild y correr el JS.
- *Node 18 quedó corto* (sharp pide 20+). nvm cargado desde `~/.profile`; el shell no interactivo no lee `.bashrc`.

**Migración de datos — cómo hacer verificable un "no perdés nada":**
- Snapshot de la fuente versionado en el repo, **la fila original completa guardada por registro** (y visible en el panel), y **verificación de conteos que aborta** si no cuadran. Una promesa que no se puede medir no sirve.
- *La escritura tiene que estar en un solo lugar*. La traducción de URLs de imagen vivía sólo en el script de descarga, pero la siembra reemplazaba las filas y la deshacía en cada corrida.
- *Un endpoint de reparación idempotente vale oro*: `POST /api/admin/resync` dejó el catálogo igual al snapshot cuando varios arranques fallidos lo dejaron a medias.

**Producto / UX:**
- *La planilla no era sólo la base de datos, también era el panel de administración.* Migrar a una base sin dar un panel al menos tan cómodo habría sido un downgrade operativo. Por eso la tabla se edita inline.
- *Un ícono sin etiqueta cuyo efecto es que la fila desaparezca se lee como "no hizo nada"*. El usuario apretó el ojito y no entendió qué pasó. Solución: la fila se queda, se atenúa y ofrece "Deshacer".
- *Medir el responsive en vez de mirarlo*: un script que recorre 360/390/768/1440 y reporta desborde horizontal, texto bajo el mínimo y controles chicos. Encontró 1816 observaciones donde a ojo "se veía bien".
- *Distinguir etiqueta de texto corrido*: las mayúsculas con tracking amplio se leen bien a 11px; el mínimo de 12px es para el texto normal. Bajar el umbral para que el reporte dé verde es hacer trampa; excluir con criterio y documentarlo, no.
