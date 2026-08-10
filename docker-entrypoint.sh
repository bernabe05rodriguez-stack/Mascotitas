#!/bin/sh
set -e

echo "→ Mascotitas: arrancando"

# 1. Migraciones. Se usa `migrate deploy` y NO `db push --accept-data-loss`:
#    en esta base viven los pedidos, y un push puede borrar columnas en silencio.
#    Si una migración falla, el contenedor no arranca — es lo que queremos.
echo "→ Aplicando migraciones"
npx prisma migrate deploy

# 2. Restaurar las fotos al volumen.
#    public/uploads está montado como volumen persistente, así que arranca vacío
#    la primera vez. data/images tiene las 305 fotos rescatadas de postimg.cc,
#    versionadas en el repo: se copian sólo las que falten (-n, nunca pisa las
#    que se subieron desde el panel).
if [ -d "./data/images" ]; then
  mkdir -p ./public/uploads
  before=$(find ./public/uploads -name '*.webp' | wc -l)
  cp -n ./data/images/*.webp ./public/uploads/ 2>/dev/null || true
  after=$(find ./public/uploads -name '*.webp' | wc -l)
  echo "→ Imágenes: $after en el volumen (se restauraron $((after - before)))"
fi

# 3. Sembrar el catálogo la primera vez.
#    Sólo corre si la tabla de productos está vacía: nunca pisa datos existentes.
echo "→ Verificando catálogo"
npx tsx ./scripts/bootstrap.ts

echo "→ Listo, sirviendo en :${PORT:-3000}"
exec node server.js
