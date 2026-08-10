# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- dependencias
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
# --ignore-scripts: sin esto, los postinstall de playwright y del postgres
# embebido (herramientas de desarrollo) se bajan cientos de MB dentro del build.
# `prisma generate` se corre explícitamente en la etapa siguiente.
RUN npm ci --ignore-scripts

# --------------------------------------------------------------------- build
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Sólo para que `prisma generate` no proteste: en el build no se conecta a nada.
# Ninguna página consulta la base al construir — todas son `force-dynamic`.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npx next build

# El script de arranque se empaqueta en un solo JS, para no tener que instalar
# tsx ni papaparse en la imagen final. Sólo @prisma/client queda afuera: necesita
# el cliente generado y su engine binario. bcryptjs va adentro del bundle porque
# Next lo mete en sus chunks y no queda suelto en el node_modules del standalone.
RUN npx esbuild scripts/bootstrap.ts \
      --bundle --platform=node --target=node20 --format=cjs \
      --external:@prisma/client \
      --outfile=bootstrap.js

# ------------------------------------------------------------------ runtime
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nextjs

# El CLI de Prisma va en su propio árbol de dependencias. Instalarlo sobre /app
# reescribiría el node_modules podado que trae el output standalone de Next.
RUN mkdir -p /opt/prisma && cd /opt/prisma \
  && npm init -y > /dev/null \
  && npm install --no-audit --no-fund prisma@6 \
  && npm cache clean --force

# La app en modo standalone: sólo lo que Next necesita para correr.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Schema + migraciones, para aplicar `migrate deploy` al arrancar.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# Copia de respaldo del catálogo y de las 305 fotos rescatadas de postimg.cc:
# de acá se resiembra el volumen si alguna vez queda vacío.
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/bootstrap.js ./scripts/bootstrap.js

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
