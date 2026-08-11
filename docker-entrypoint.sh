#!/bin/sh
# Arranque del contenedor.
#
# Deliberadamente NO usa `set -e`. EasyPanel no expone los logs del contenedor
# por API, así que un arranque que aborta se ve desde afuera como un 502 mudo,
# imposible de diagnosticar. En vez de eso: se registra todo en BOOT_LOG, el
# servidor levanta igual, `/api/health` reporta el problema y `/api/boot`
# devuelve este log completo. Fallar sigue siendo visible — pero legible.

BOOT_LOG=/tmp/boot.log
: > "$BOOT_LOG"

log() {
  echo "$(date -u +%H:%M:%S) $*" | tee -a "$BOOT_LOG"
}

run() {
  log "\$ $*"
  "$@" >> "$BOOT_LOG" 2>&1
  status=$?
  log "  -> exit $status"
  return $status
}

log "=== Mascotitas: arrancando ==="
log "node $(node --version) | usuario $(id -un) uid=$(id -u)"

# 1. Migraciones.
#    `migrate deploy` y NO `db push --accept-data-loss`: en esta base viven los
#    pedidos y un push puede borrar columnas en silencio.
log "--- migraciones ---"
if run /opt/prisma/node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma; then
  log "migraciones OK"
else
  log "!! FALLARON LAS MIGRACIONES — la app va a levantar pero sin datos"
fi

# 2. Restaurar las fotos al volumen.
#    public/uploads es un volumen persistente, así que arranca vacío la primera
#    vez. data/images tiene las 305 fotos rescatadas de postimg.cc, versionadas
#    en el repo. Se copian sólo las que falten: nunca pisa lo subido del panel.
log "--- imágenes ---"
DEST="${UPLOADS_DIR:-/app/uploads}"
if [ -d ./data/images ]; then
  mkdir -p "$DEST" 2>>"$BOOT_LOG"
  if [ -w "$DEST" ]; then
    cp -n ./data/images/*.webp "$DEST"/ 2>>"$BOOT_LOG"
    log "imágenes en el volumen ($DEST): $(ls "$DEST"/*.webp 2>/dev/null | wc -l)"
  else
    log "!! $DEST NO es escribible por $(id -un) — las fotos no se restauran"
  fi
else
  log "!! no existe ./data/images"
fi

# 3. Sembrar el catálogo, sólo si la base está vacía.
log "--- catálogo ---"
run node ./scripts/bootstrap.js

log "--- sirviendo en :${PORT:-3000} ---"

# 4. Backup diario automático en background.
#    Cada 24h hace un pg_dump comprimido. Mantiene los últimos 7.
BACKUP_DIR="${UPLOADS_DIR:-/app/uploads}/../backups"
mkdir -p "$BACKUP_DIR" 2>/dev/null
(
  while true; do
    sleep 86400  # 24 horas
    TS=$(date -u +%Y-%m-%dT%H-%M-%S)
    FILE="$BACKUP_DIR/mascotitas-$TS.sql.gz"
    if pg_dump "$DATABASE_URL" 2>/dev/null | gzip > "$FILE"; then
      log "backup OK: $FILE ($(du -h "$FILE" | cut -f1))"
      # Rotar: mantener últimos 7
      ls -1t "$BACKUP_DIR"/mascotitas-*.sql.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null
    else
      log "!! backup falló"
      rm -f "$FILE" 2>/dev/null
    fi
  done
) &

exec node server.js
